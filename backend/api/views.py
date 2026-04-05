from django.http import JsonResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Q # Import Q objects for complex queries

import json

def health(request):
    return JsonResponse({'status': 'ok'})

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
    return JsonResponse({'id': user.id, 'username': user.username})


@csrf_exempt
def search_users(request):
    query = request.GET.get('q')
    if query:
        results = User.objects.filter(
            Q(username__icontains=query) | Q(email__icontains=query)
        ).distinct()
    else:
        results = User.objects.none()

    data = list(results.values('id', 'username', 'email'))
    return JsonResponse(data, safe=False)