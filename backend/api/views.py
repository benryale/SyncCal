from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from .models import FriendRequest
import json

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
                u['friend_status'] = sent_map[u['id']]  # 'pending' or 'accepted'
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
def register(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    data = json.loads(request.body)
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if User.objects.filter(username=username).exists():
        return JsonResponse({'error': 'Username already taken'}, status=400)

    user = User.objects.create_user(username=username, email=email, password=password)
    login(request, user)
    return JsonResponse({'id': user.id, 'username': user.username}, status=201)

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

    login(request, user)
    return JsonResponse({'id': user.id, 'username': user.username})\
        
