const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const QRCodeGenerator = require('qrcode');
const app = express();
const port = process.env.PORT || 3000;

let currentQR = ''; // Variável para armazenar o QR Code para o site

// Inicializa o banco de dados
const dbFile = 'lista_compras_v2.db'; // Usar novo banco de dados
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
    // Cria tabela com autor da mensagem
    db.run(`CREATE TABLE IF NOT EXISTS compras (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        item TEXT, 
        author TEXT
    )`);
});

// Inicializa cliente do WhatsApp Web
const client = new Client({
    authStrategy: new LocalAuth(), // Mantém a sessão ativa
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    }
});

let lastListMessages = {}; // Dicionário para rastrear a última mensagem da lista enviada por chat

// Gera QR Code no terminal e no site
client.on('qr', async (qr) => {
    console.log('--- NOVO LOGIN NECESSÁRIO ---');
    qrcode.generate(qr, { small: true });
    
    // Gera imagem para o site
    try {
        currentQR = await QRCodeGenerator.toDataURL(qr);
        console.log(`Acesse o site para escanear: https://botmercado.onrender.com (ou a URL do seu Render)`);
    } catch (err) {
        console.error('Erro ao gerar QR Code para o site:', err);
    }
    
    console.log('Escaneie o QR Code acima com o seu WhatsApp!');
});

client.on('ready', () => {
    console.log('✅ Bot conectado e pronto para uso!');
});

// Adiciona um item e exibe a lista
async function addItem(chat, itemText, authorName) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO compras (item, author) VALUES (?, ?)', [itemText, authorName], function(err) {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }
            resolve();
        });
    });
}

// Limpa a lista
async function clearList() {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM compras', function(err) {
            if (err) reject(err);
            else resolve();
        });
    });
}

// Envia a lista completa e remove a anterior para manter por último
async function sendListAndPin(chat) {
    db.all('SELECT * FROM compras', async (err, rows) => {
        if (err) return;

        let listText = '*📝 Sua Lista de Compras:*\n\n';
        if (rows.length === 0) {
            listText += '_A lista está vazia!_\n\n👉 Para adicionar, digite: *add [item]*';
        } else {
            rows.forEach((row) => {
                listText += `🛒 *${row.item}* _(por: ${row.author})_\n`;
            });
            listText += '\n👉 Para adicionar mais itens, digite: *add [item]*';
            listText += '\n👉 Para limpar tudo, digite: *limpar*';
        }

        const chatId = chat.id._serialized;
        
        // Deleta a mensagem anterior da lista se houver
        if (lastListMessages[chatId]) {
            try {
                // Tenta apagar a mensagem antiga enviada pelo bot
                await lastListMessages[chatId].delete(true);
            } catch (e) {
                console.log("Aviso: Não foi possível apagar a mensagem antiga da lista (pode já ter sido apagada por outro).");
            }
        }

        // Envia nova lista e salva o objeto
        try {
            const sentMsg = await chat.sendMessage(listText);
            lastListMessages[chatId] = sentMsg;
        } catch (e) {
            console.error("Erro ao enviar a lista:", e);
        }
    });
}

// Escuta mensagens
client.on('message_create', async (message) => {
    try {
        const chat = await message.getChat();
        
        // Apenas para grupos
        if (!chat.isGroup) return; 
        
        console.log(`[DEBUG] Mensagem recebida no grupo ${chat.name}: ${message.body}`);
        
        const text = message.body.trim();
        const contact = await message.getContact();
        const authorName = contact.pushname || contact.name || contact.number;

        if (text.toLowerCase().startsWith('add ')) {
            const item = text.substring(4).trim();
            if (!item) return;

            // Deleta a mensagem original da pessoa (!Importante: O bot precisa ser Admin do grupo)
            try {
                await message.delete(true);
            } catch (e) {
                console.log(`Não foi possível apagar a mensagem de ${authorName}. O bot precisa ser Admin do grupo.`);
            }

            await addItem(chat, item, authorName);
            await sendListAndPin(chat);
            
        } else if (text.toLowerCase() === 'lista') {
            try { await message.delete(true); } catch(e) {}
            await sendListAndPin(chat);
        } else if (text.toLowerCase() === 'limpar') {
            try { await message.delete(true); } catch(e) {}
            await clearList();
            
            // Envia alerta de limpeza e chama a lista
            await chat.sendMessage("🗑️ _A Lista de compras foi limpa!_");
            await sendListAndPin(chat);
        }
    } catch (e) {
        console.error(e);
    }
});

// Inicia o cliente
client.initialize();

// Servidor Web para facilitar o escaneamento no Render
app.get('/', (req, res) => {
    if (currentQR) {
        res.send(`
            <html>
                <head>
                    <title>Conectar WhatsApp Bot</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f0f2f5; margin: 0; }
                        .container { background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; max-width: 90%; }
                        img { width: 300px; height: 300px; border: 15px solid white; border-radius: 5px; box-shadow: 0 0 10px rgba(0,0,0,0.1); margin: 20px 0; }
                        h1 { color: #128c7e; font-size: 1.5rem; }
                        p { color: #555; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Conectar seu WhatsApp</h1>
                        <p>Escaneie o QR Code abaixo usando o menu "Aparelhos Conectados" no seu celular:</p>
                        <img src="${currentQR}">
                        <p><i>Se o QR expirar, atualize esta página.</i></p>
                    </div>
                </body>
            </html>
        `);
    } else {
        res.send(`
            <html>
                <body style="font-family:sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh;">
                    <h1 style="color:#128c7e;">Bot Operacional</h1>
                    <p>O bot já está conectado ou o QR Code ainda não foi gerado.</p>
                    <p>Se você acabou de iniciar, aguarde alguns segundos e atualize a página.</p>
                </body>
            </html>
        `);
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor HTTP rodando na porta ${port}`);
});
