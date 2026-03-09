const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const sqlite3 = require('sqlite3').verbose();

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
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

let lastListMessages = {}; // Dicionário para rastrear a última mensagem da lista enviada por chat

// Gera QR Code no terminal
client.on('qr', (qr) => {
    console.log('--- NOVO LOGIN NECESSÁRIO ---');
    qrcode.generate(qr, { small: true });
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
