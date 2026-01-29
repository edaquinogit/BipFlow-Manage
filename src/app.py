import streamlit as st
import pandas as pd
import os
import datetime
# Importando as funções do seu outro arquivo
from main import carregar_estoque, registrar_saida
# Configuração visual da página
st.set_page_config(page_title="BipFlow Manager", layout="wide")

st.title("🚀 BipFlow | Inteligência Logística")

# --- ÁREA DE OPERAÇÃO ---
col1, col2 = st.columns([1, 1])

with col1:
    st.subheader("📦 Registro de Saída")
    # O campo onde você vai bipar
    codigo_bip = st.text_input("Bipe o código de barras aqui", key="bip_input")

    if codigo_bip:
        estoque = carregar_estoque()
        
        if codigo_bip in estoque:
            produto = estoque[codigo_bip]
            st.success(f"**PRODUTO IDENTIFICADO!**")
            
            # --- EXIBIÇÃO DE IMAGEM ---
            # Verifica se a imagem existe na pasta data/assets/
            caminho_imagem = f"../data/assets/{codigo_bip}.jpg"
            
            if os.path.exists(caminho_imagem):
                st.image(caminho_imagem, caption=f"Estampa: {produto['estampa']}", width=300)
            else:
                st.warning("📷 Foto não cadastrada para este item.")
            
            # Mostra a localização (Gaiola) bem grande
            st.metric(label="📍 LOCALIZAÇÃO", value=f"GAIOLA {produto['gaiola']}")
            st.write(f"**Item:** {produto['nome']}")
            st.write(f"**Variação:** {produto['estampa']} - {produto['tamanho']}")
            
            if st.button("Confirmar Saída", use_container_width=True):
                registrar_saida(codigo_bip)
                st.toast(f"Saída de {produto['nome']} registrada!", icon="✅")
                st.rerun()
        else:
            st.error("🚫 Código não encontrado no estoque.")

with col2:
    st.subheader("📊 Histórico Recente")
    caminho_log = "data/historico_vendas.csv"
    if os.path.exists(caminho_log):
        df = pd.read_csv(caminho_log, sep=";")
        st.dataframe(df.tail(10), use_container_width=True)
    else:
        st.info("Aguardando primeira movimentação...")