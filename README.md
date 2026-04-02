# 🎬 Blueycast

Plataforma de streaming com autenticação Firebase, pagamentos via PIX e screencast de tela.

---

## Stack

- **Backend** Node.js + Express
- **Auth** Firebase Authentication (email/senha + Google)
- **Pagamentos** OpenPix (PIX) com promoção de conta Free → Premium via Firebase Custom Claims
- **Screencast** Web API `getDisplayMedia` + `MediaRecorder`
- **Frontend** HTML/CSS/JS puro com Firebase SDK via CDN

---

## Pré-requisitos

- Node.js 18+
- Conta Firebase (gratuita)
- Conta OpenPix (gratuita para sandbox)

---

## Setup Passo a Passo

### 1. Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Crie um projeto → **Authentication → Sign-in methods** → ative **E-mail/senha** e **Google**
3. **Configurações do projeto → Contas de serviço → Gerar nova chave privada**
   - Salve como `firebase-service-account.json` (NÃO comitar)
4. **Configurações do projeto → Seu app web** → copie as credenciais do cliente

### 2. OpenPix (PIX)

1. Crie conta em [app.openpix.com.br](https://app.openpix.com.br)
2. **Configurações → API/Plugins → Criar App**
3. Copie o **App ID** (token de autenticação)
4. Opcional: configure o Webhook em **API/Plugins → Webhooks**
   - URL: `https://seu-dominio.com/api/payment/webhook`
   - Evento: `OPENPIX:CHARGE_COMPLETED`

### 3. Variáveis de Ambiente

```bash
cp .env.example .env
# Edite o .env com suas credenciais reais
```

### 4. Configurar o Frontend

Edite `public/js/app.js` e substitua o objeto `FIREBASE_CONFIG` com os dados
do seu app web Firebase:

```js
const FIREBASE_CONFIG = {
  apiKey:            'AIzaSy...',
  authDomain:        'meu-projeto.firebaseapp.com',
  projectId:         'meu-projeto',
  messagingSenderId: '123456789',
  appId:             '1:123456789:web:abc123',
};
```

### 5. Instalar e Rodar

```bash
npm install
npm run dev     # desenvolvimento com nodemon
npm start       # produção
```

Acesse: http://localhost:3000

---

## Arquitetura

```
Blueycast/
├── server.js                 # Express server + static files
├── .env.example              # Template de variáveis de ambiente
├── middleware/
│   ├── firebase.js           # Inicialização Firebase Admin SDK
│   └── authMiddleware.js     # Verificação de token + premium guard
├── routes/
│   ├── videos.js             # Catálogo (free e premium)
│   └── payment.js            # PIX via OpenPix, webhook, promoção de conta
└── public/
    ├── index.html            # SPA: tela de auth + app
    ├── css/styles.css        # Design system dark/amber
    └── js/app.js             # Firebase Auth, player, screencast, modal PIX
```

## Fluxo de Pagamento PIX

```
Usuário clica "Assinar Premium"
  → POST /api/payment/pix/create
  → OpenPix cria cobrança, retorna QR code + brCode
  → Frontend exibe QR code
  → Usuário paga pelo app do banco
  → Webhook OpenPix chama POST /api/payment/webhook
    OU usuário clica "Já paguei" → GET /api/payment/pix/status/:id
  → Backend verifica status com OpenPix
  → Se COMPLETED: Firebase Admin seta custom claim { premium: true }
  → Frontend força refresh do token → UI atualiza para Premium
```

## Screencast

O botão **"Screencast da Tela"** usa `navigator.mediaDevices.getDisplayMedia()` para
capturar a tela (com áudio opcional), grava com `MediaRecorder` e ao finalizar gera
um arquivo `.webm` para preview e download — sem precisar de servidor.

## Produção

- Use HTTPS (requisito do `getDisplayMedia` e Firebase Auth)
- Configure `ALLOWED_ORIGIN` no `.env` com seu domínio
- Substitua o Map de `pendingCharges` por Redis ou banco de dados
- Configure o webhook OpenPix para ativação automática sem polling
- Adicione os vídeos num banco de dados real (PostgreSQL, Firestore, etc.)
