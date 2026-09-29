# iNFRA Backend - API REST & Serviço de Dados

> Backend em Node.js / Express para suporte e integração do sistema de gestão de infraestrutura e logística **iNFRA**.

---

## 🛠️ Tecnologias e Arquitetura

- **Runtime:** [Node.js](https://nodejs.org/)
- **Framework Web:** [Express.js](https://expressjs.com/)
- **Banco de Dados:** PostgreSQL (compatível com Railway / Neon / AWS RDS)
- **Deploy:** Containerizado via Dockerfile e pronto para Railway / Nixpacks
- **Comunicação em Tempo Real / Notificações:** Suporte a integração com webhooks e WhatsApp (vide `WHATSAPP_INTEGRATION.md`)

---

## 🚀 Como Executar

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar variáveis de ambiente
```bash
cp .env.example .env
```
Ajuste as credenciais do seu banco de dados PostgreSQL.

### 3. Verificar conexão com o banco
```bash
node check_db.js
```

### 4. Iniciar o servidor
```bash
npm start
# ou com reinício automático:
npm run dev
```
Servidor ativo na porta padrão `http://localhost:5001`.

---

## ☁️ Deploy no Railway

O repositório já contém `railway.toml`, `Procfile` e `Dockerfile`. Ao vincular o repositório ao Railway, crie um plugin de **PostgreSQL** e as variáveis de banco serão injetadas automaticamente no ambiente de produção.
