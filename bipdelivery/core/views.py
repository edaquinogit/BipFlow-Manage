from django.shortcuts import render

def home(request):
    return render(request, 'index.html')

from django.conf import settings
def home(request):
    print(f"DEBUG: Procurando templates em: {settings.TEMPLATES[0]['DIRS']}")
    return render(request, 'index.html')