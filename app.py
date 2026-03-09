import sqlite3
from flask import Flask, request
from twilio.twiml.messaging_response import MessagingResponse

app = Flask(__name__)

# Função para conectar ao banco e garantir que a tabela existe
def gerenciar_bd(query, params=(), fetch=False):
    conn = sqlite3.connect('lista_compras.db')
    cursor = conn.cursor()
    cursor.execute('CREATE TABLE IF NOT EXISTS compras (id INTEGER PRIMARY KEY, item TEXT)')
    cursor.execute(query, params)
    resultado = cursor.fetchall() if fetch else None
    conn.commit()
    conn.close()
    return resultado

@app.route("/bot", methods=['POST'])
def bot():
    # Pega o que você digitou no WhatsApp
    mensagem_usuario = request.values.get('Body', '').strip().lower()
    resposta_twilio = MessagingResponse()
    msg = resposta_twilio.message()

    # Lógica de Comandos
    if mensagem_usuario.startswith('add '):
        item = mensagem_usuario.replace('add ', '').capitalize()
        gerenciar_bd("INSERT INTO compras (item) VALUES (?)", (item,))
        msg.body(f"✅ Adicionado: {item}")

    elif mensagem_usuario == 'lista':
        itens = gerenciar_bd("SELECT item FROM compras", fetch=True)
        if itens:
            texto_lista = "\n".join([f"🛒 {i[0]}" for i in itens])
            msg.body(f"*Sua Lista de Compras:*\n\n{texto_lista}")
        else:
            msg.body("A lista está vazia!")

    elif mensagem_usuario == 'limpar':
        gerenciar_bd("DELETE FROM compras")
        msg.body("🗑️ Lista limpa com sucesso!")

    else:
        msg.body("Comandos disponíveis:\n👉 *Add [item]*\n👉 *Lista*\n👉 *Limpar*")

    return str(resposta_twilio)

if __name__ == "__main__":
    app.run(port=5000)