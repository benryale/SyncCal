import json
import logging

from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from events.zone_utils import validate_iana_timezone
from .models import FriendRequest, UserProfile

logger = logging.getLogger(__name__)

def health(request):
    return JsonResponse({'status': 'ok'})

@csrf_exempt
def search_users(request):
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    q = request.GET.get('q', '').strip()
    if not q:
        return JsonResponse([], safe=False)
    
    qs = User.objects.filter(username__icontains=q)
    if request.user.is_authenticated:
        qs = qs.exclude(id=request.user.id)
    users = list(qs.values('id', 'username', 'email')[:20])
    
    if request.user.is_authenticated:
        sent = set(FriendRequest.objects.filter(
            from_user=request.user,
            to_user_id__in=[u['id'] for u in users]
        ).values_list('to_user_id', 'status'))
        received = set(FriendRequest.objects.filter(
            to_user=request.user,
            from_user_id__in=[u['id'] for u in users]
        ).values_list('from_user_id', 'status'))

        sent_map = {uid: status for uid, status in sent}
        received_map = {uid: status for uid, status in received}

        for u in users:
            if u['id'] in sent_map:
                u['friend_status'] = sent_map[u['id']]
            elif u['id'] in received_map:
                u['friend_status'] = received_map[u['id']]
            else:
                u['friend_status'] = 'none'
    else:
        for u in users:
            u['friend_status'] = 'none'

    return JsonResponse(users, safe=False)

@csrf_exempt
def send_friend_request(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    data = json.loads(request.body)
    to_user_id = data.get('to_user_id')

    try:
        to_user = User.objects.get(id=to_user_id)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)

    if to_user == request.user:
        return JsonResponse({'error': 'Cannot send request to yourself'}, status=400)

    freq, created = FriendRequest.objects.get_or_create(
        from_user=request.user,
        to_user=to_user,
        defaults={'status': 'pending'}
    )

    if not created and freq.status == 'declined':
        freq.status = 'pending'
        freq.save()

    return JsonResponse({'status': freq.status}, status=201 if created else 200)

@csrf_exempt
def respond_to_friend_request(request, request_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    data = json.loads(request.body)
    action = data.get('action')

    if action not in ('accept', 'decline'):
        return JsonResponse({'error': 'Invalid action. Use "accept" or "decline".'}, status=400)

    try:
        freq = FriendRequest.objects.get(id=request_id, to_user=request.user)
    except FriendRequest.DoesNotExist:
        return JsonResponse({'error': 'Friend request not found'}, status=404)

    if freq.status != 'pending':
        return JsonResponse({'error': 'Request already handled'}, status=400)

    freq.status = 'accepted' if action == 'accept' else 'declined'
    freq.save()

    return JsonResponse({'status': freq.status})


def list_friend_requests(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    pending = FriendRequest.objects.filter(to_user=request.user, status='pending').select_related('from_user')
    data = [
        {
            'id': fr.id,
            'from_user_id': fr.from_user.id,
            'from_username': fr.from_user.username,
            'created_at': fr.created_at.isoformat(),
        }
        for fr in pending
    ]
    return JsonResponse(data, safe=False)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_friends(request):
    user = request.user
    accepted_requests = FriendRequest.objects.filter(
        (Q(from_user=user) | Q(to_user=user)),
        status='accepted'
    )
    friends = []
    for req in accepted_requests:
        if req.from_user == user:
            friends.append(req.to_user)
        else:
            friends.append(req.from_user)
        
    friend_data = [{'id': friend.id, 'username': friend.username} for friend in friends]
    return Response(friend_data)

@csrf_exempt
def register(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    data = json.loads(request.body)
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    tz_hint = data.get('timezone')

    if User.objects.filter(username=username).exists():
        return JsonResponse({'error': 'Username already taken'}, status=400)

    user = User.objects.create_user(username=username, email=email, password=password)

    # Always create the profile explicitly — never rely on signals alone
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults={'timezone': 'UTC'})

    if tz_hint:
        try:
            validate_iana_timezone(tz_hint)
        except DjangoValidationError:
            logger.warning(
                'register: ignoring invalid timezone %r for user %s; profile stays at UTC',
                tz_hint, user.username,
            )
        else:
            profile.timezone = tz_hint
            profile.save(update_fields=['timezone', 'updated_at'])

    token, _ = Token.objects.get_or_create(user=user)
    login(request, user)
    return JsonResponse(
        {
            'token':    token.key,
            'id':       user.id,
            'username': user.username,
            'timezone': profile.timezone,
        },
        status=201,
    )

@csrf_exempt
def login_view(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    data = json.loads(request.body)
    username = data.get('username')
    password = data.get('password')

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({'error': 'Invalid credentials'}, status=401)

    token, _ = Token.objects.get_or_create(user=user)
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults={'timezone': 'UTC'})
    login(request, user)
    return JsonResponse({
        'token':    token.key,
        'id':       user.id,
        'username': user.username,
        'timezone': profile.timezone,
    })


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults={'timezone': 'UTC'})

    if request.method == 'PATCH':
        tz = request.data.get('timezone')
        if tz is None:
            return Response(
                {'error': 'timezone is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_iana_timezone(tz)
        except DjangoValidationError as exc:
            return Response(
                {'timezone': exc.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.timezone = tz
        profile.save(update_fields=['timezone', 'updated_at'])

    return Response({
        'id':       user.id,
        'username': user.username,
        'email':    user.email,
        'timezone': profile.timezone,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    current_password = request.data.get('current_password', '')
    new_password     = request.data.get('new_password', '')

    if not current_password or not new_password:
        return Response(
            {'error': 'Both current_password and new_password are required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(new_password) < 6:
        return Response(
            {'error': 'New password must be at least 6 characters'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = authenticate(request, username=request.user.username, password=current_password)
    if user is None:
        return Response(
            {'error': 'Current password is incorrect'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save()

    Token.objects.filter(user=user).delete()
    new_token = Token.objects.create(user=user)

    return Response({'token': new_token.key, 'message': 'Password changed successfully'})