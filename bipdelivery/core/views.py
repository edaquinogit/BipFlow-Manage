from django.http import JsonResponse


def home(request):
    return JsonResponse({"message": "API Django rodando com sucesso!"})
