# Integração WhatsApp - Upload de Fotos

## Visão Geral
Sistema para receber fotos das obras via WhatsApp, permitindo que as empresas contratadas enviem atualizações fotográficas diretamente pelo celular.

## Métodos de Integração

### 1. **WhatsApp Business API (Recomendado para Produção)**

#### Provedores Sugeridos:
- **Twilio** (https://www.twilio.com/whatsapp)
- **Meta Cloud API** (https://developers.facebook.com/docs/whatsapp/cloud-api)
- **MessageBird** (https://messagebird.com/whatsapp)
- **Vonage** (https://www.vonage.com/communications-apis/messages/)

#### Configuração Twilio (Exemplo):
```javascript
// Instalar SDK
npm install twilio

// Código de integração
const twilio = require('twilio');
const accountSid = 'SEU_ACCOUNT_SID';
const authToken = 'SEU_AUTH_TOKEN';
const client = twilio(accountSid, authToken);

// Webhook para receber mensagens
app.post('/api/whatsapp/webhook', async (req, res) => {
    const { From, MediaUrl0, Body } = req.body;
    
    // Baixar imagem do WhatsApp
    if (MediaUrl0) {
        const response = await fetch(MediaUrl0);
        const buffer = await response.buffer();
        
        // Salvar imagem localmente
        const filename = `whatsapp-${Date.now()}.jpg`;
        fs.writeFileSync(`./uploads/${filename}`, buffer);
        
        // Retornar URL
        const photoUrl = `/uploads/${filename}`;
        
        // Associar à fase da obra (pode usar o Body para identificar)
        console.log(`Foto recebida de ${From}: ${photoUrl}`);
    }
    
    res.status(200).send('OK');
});
```

### 2. **WhatsApp Web Scraping (Alternativa Simples)**

#### Usando Baileys ou Venom-bot:
```bash
npm install @whiskeysockets/baileys
```

```javascript
const { default: makeWASocket } = require('@whiskeysockets/baileys');

async function startWhatsAppBot() {
    const sock = makeWASocket({
        printQRInTerminal: true
    });
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        
        if (msg.message?.imageMessage) {
            const buffer = await downloadMediaMessage(msg);
            const filename = `whatsapp-${Date.now()}.jpg`;
            fs.writeFileSync(`./uploads/${filename}`, buffer);
            
            // Notificar frontend via WebSocket ou polling
            console.log(`Nova foto recebida: /uploads/${filename}`);
        }
    });
}
```

### 3. **Upload Manual via Web Interface (Atual)**
- Upload direto de arquivos pelo navegador
- Link para abrir WhatsApp Web
- Número dedicado para envio

## Configuração do Sistema

### Backend - Endpoint de Upload
```javascript
// POST /api/whatsapp/photos
// Aceita múltiplos arquivos
// Campos: serviceId, phaseId, phoneNumber
```

### Frontend - Modal de Upload
- Botão em cada fase da obra
- Exibe número do WhatsApp
- Link direto para conversa
- Upload manual como alternativa

## Fluxo de Trabalho

1. **Empresa contratada** abre o WhatsApp
2. **Envia foto** para o número do sistema (+55 95 98765-4321)
3. **Sistema recebe** a foto via webhook
4. **Foto é automaticamente** associada à fase da obra
5. **Dashboard atualiza** em tempo real

## Segurança

- Token de autenticação no webhook
- Validação de números autorizados
- Limite de uploads por dia
- Compressão automática de imagens
- Verificação de tipo de arquivo

## Próximos Passos

1. Contratar plano WhatsApp Business API
2. Configurar webhook público (ngrok ou servidor)
3. Implementar autenticação de números
4. Criar sistema de notificações
5. Adicionar reconhecimento automático de fase por IA

## Custos Estimados

- **Twilio WhatsApp**: ~$0.005 por mensagem
- **Meta Cloud API**: Gratuito até 1000 conversas/mês
- **MessageBird**: A partir de $0.0075 por mensagem

## Suporte

Para dúvidas sobre integração WhatsApp:
- Documentação Twilio: https://www.twilio.com/docs/whatsapp
- Documentação Meta: https://developers.facebook.com/docs/whatsapp
- Repositório Baileys: https://github.com/WhiskeySockets/Baileys
