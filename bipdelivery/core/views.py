from django.shortcuts import render

def home(request):
    """
    Renderiza a página principal do BipFlow Delivery.
    Utiliza o template 'home.html' que contém a estrutura de grid
    e injeção de estilos específicos.
    """
    return render(request, 'home.html')