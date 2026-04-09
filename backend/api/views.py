from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from .models import FriendRequest
import json
from rest_framework.authtoken.models import Token

def health(request):
    return JsonResponse({'status': 'ok'})

@csrf_exempt
def search_users(request):
    ## check method if is GET 
    if request.method != 'GET':
        ## if is not return error
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    ## extracts and clean the search query from url 
    q = request.GET.get('q', '').strip()
    if not q:
        return JsonResponse([], safe=False)
    
    ## search for users and exclude oneself 
    qs = User.objects.filter(username__icontains=q)
    if request.user.is_authenticated:
        qs = qs.exclude(id=request.user.id)
    ## extracts user data from the database query, limits results, and executes it
    users = list(qs.values('id', 'username', 'email')[:20])
    
    
    ## check if the user is authenticated
    ## checks what friend requests exist between the logged-in user and each search result. 
    ## It determines whether to show "Add Friend", "Pending", or "Friends" buttons.
    if request.user.is_authenticated:
        
        sent = set(FriendRequest.objects.filter(
            # WHERE sender = me
            from_user=request.user,
            # AND receiver = any search result
            to_user_id__in=[u['id'] for u in users]
            # GET (receiver_id, status)
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
def respond_to_friend_request(request, request_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    data = json.loads(request.body)
    action = data.get('action')  # 'accept' or 'decline'

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


def list_friends(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)
    if request.method != 'GET':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    from django.db.models import Q
    accepted = FriendRequest.objects.filter(
        Q(from_user=request.user) | Q(to_user=request.user),
        status='accepted'
    ).select_related('from_user', 'to_user')

    friends = []
    for fr in accepted:
        friend = fr.to_user if fr.from_user == request.user else fr.from_user
        friends.append({
            'id': friend.id,
            'username': friend.username,
        })

    return JsonResponse(friends, safe=False)


@csrf_exempt
def register(request):
    # Only accept POST requests 
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    # Parse JSON body to extract username, email, password
    data = json.loads(request.body)
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    # Check if username already exists in database
    if User.objects.filter(username=username).exists():
        return JsonResponse({'error': 'Username already taken'}, status=400)

    # Create new user with hashed password (Django handles hashing automatically)
    user = User.objects.create_user(username=username, email=email, password=password)
    # Log in the user immediately after registration (create session)
    login(request, user)
    # Return user ID and username to frontend (status 201 = Created)
    return JsonResponse({'id': user.id, 'username': user.username}, status=201)

@csrf_exempt
def login_view(request):
    # Only accept POST requests (login credentials)
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)

    # Extract username and password from request body
    data = json.loads(request.body)
    username = data.get('username')
    password = data.get('password')

    # Authenticate user (checks username & password against database)
    user = authenticate(request, username=username, password=password)
    # If invalid credentials, authentication returns None
    if user is None:
        return JsonResponse({'error': 'Invalid credentials'}, status=401)

    # Get or create an authentication token for this user (REST API requires token-based auth)
    token, created = Token.objects.get_or_create(user=user)
    # Create a session for the user (traditional session-based auth)
    login(request, user)
    # Return token, user ID, and username to frontend (token is used for API calls)
    return JsonResponse({'token': token.key, 'id': user.id, 'username': user.username})
        
