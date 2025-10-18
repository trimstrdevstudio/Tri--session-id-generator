const express = require('express');
const QRCode = require('qrcode');
const { makeWASocket, useMultiFileAuthState, Browsers, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session storage
const sessions = new Map();

// HTML Template
const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TRI CONTROLS BOT - Session Generator</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .container {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            max-width: 500px;
            width: 100%;
            text-align: center;
            backdrop-filter: blur(10px);
        }

        .logo {
            width: 80px;
            height: 80px;
            margin: 0 auto 20px;
            background: linear-gradient(45deg, #ff6b6b, #feca57);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            color: white;
        }

        h1 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 28px;
        }

        .subtitle {
            color: #7f8c8d;
            margin-bottom: 30px;
            font-size: 16px;
        }

        .tabs {
            display: flex;
            margin-bottom: 30px;
            background: #ecf0f1;
            border-radius: 50px;
            padding: 5px;
        }

        .tab {
            flex: 1;
            padding: 12px;
            border: none;
            background: transparent;
            border-radius: 50px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
        }

        .tab.active {
            background: #3498db;
            color: white;
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
            animation: fadeIn 0.5s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .input-group {
            margin-bottom: 20px;
            text-align: left;
        }

        label {
            display: block;
            margin-bottom: 8px;
            color: #2c3e50;
            font-weight: 600;
        }

        input {
            width: 100%;
            padding: 15px;
            border: 2px solid #ecf0f1;
            border-radius: 10px;
            font-size: 16px;
            transition: border-color 0.3s ease;
        }

        input:focus {
            outline: none;
            border-color: #3498db;
        }

        .btn {
            background: linear-gradient(45deg, #3498db, #2980b9);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            width: 100%;
        }

        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(52, 152, 219, 0.3);
        }

        .btn:disabled {
            background: #bdc3c7;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }

        .qr-container {
            margin: 20px 0;
            padding: 20px;
            background: white;
            border-radius: 10px;
            border: 2px dashed #bdc3c7;
        }

        #qrImage {
            max-width: 100%;
            height: auto;
        }

        .status {
            margin: 20px 0;
            padding: 15px;
            border-radius: 10px;
            font-weight: 600;
        }

        .status.connecting {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
        }

        .status.success {
            background: #d1ecf1;
            color: #0c5460;
            border: 1px solid #bee5eb;
        }

        .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .session-code {
            background: #2c3e50;
            color: white;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            word-break: break-all;
            font-family: monospace;
        }

        .footer {
            margin-top: 30px;
            color: #7f8c8d;
            font-size: 14px;
        }

        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">TRI</div>
        <h1>TRI CONTROLS BOT</h1>
        <p class="subtitle">Advanced WhatsApp Session Generator</p>
        
        <div class="tabs">
            <button class="tab active" onclick="switchTab('qr')">QR Code</button>
            <button class="tab" onclick="switchTab('pair')">Pairing Code</button>
        </div>

        <!-- QR Code Tab -->
        <div id="qrTab" class="tab-content active">
            <div class="qr-container">
                <img id="qrImage" src="" alt="QR Code">
            </div>
            <div id="qrStatus" class="status"></div>
            <button class="btn" onclick="generateQR()" id="qrBtn">
                Generate QR Code
            </button>
        </div>

        <!-- Pairing Code Tab -->
        <div id="pairTab" class="tab-content">
            <div class="input-group">
                <label for="phoneNumber">Phone Number (with country code):</label>
                <input type="text" id="phoneNumber" placeholder="e.g., 263780166288" maxlength="15">
            </div>
            <div id="pairStatus" class="status"></div>
            <div id="sessionCode" class="session-code" style="display: none;"></div>
            <button class="btn" onclick="generatePairCode()" id="pairBtn">
                Generate Pairing Code
            </button>
        </div>

        <div class="footer">
            &copy; 2024 TRI MSTR DEV STUDIO | GHOSTTRI
        </div>
    </div>

    <script>
        function switchTab(tabName) {
            // Update tabs
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            event.target.classList.add('active');
            document.getElementById(tabName + 'Tab').classList.add('active');
        }

        async function generateQR() {
            const qrBtn = document.getElementById('qrBtn');
            const qrStatus = document.getElementById('qrStatus');
            const qrImage = document.getElementById('qrImage');

            qrBtn.disabled = true;
            qrBtn.innerHTML = '<div class="loading"></div> Generating...';
            qrStatus.className = 'status connecting';
            qrStatus.innerHTML = 'Generating QR Code...';

            try {
                const response = await fetch('/api/qr');
                if (response.ok) {
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    qrImage.src = url;
                    qrStatus.className = 'status success';
                    qrStatus.innerHTML = 'QR Code generated! Scan with WhatsApp.';
                } else {
                    throw new Error('Failed to generate QR code');
                }
            } catch (error) {
                qrStatus.className = 'status error';
                qrStatus.innerHTML = 'Error: ' + error.message;
            } finally {
                qrBtn.disabled = false;
                qrBtn.innerHTML = 'Generate QR Code';
            }
        }

        async function generatePairCode() {
            const pairBtn = document.getElementById('pairBtn');
            const pairStatus = document.getElementById('pairStatus');
            const sessionCode = document.getElementById('sessionCode');
            const phoneNumber = document.getElementById('phoneNumber').value;

            if (!phoneNumber) {
                pairStatus.className = 'status error';
                pairStatus.innerHTML = 'Please enter a phone number';
                return;
            }

            pairBtn.disabled = true;
            pairBtn.innerHTML = '<div class="loading"></div> Generating...';
            pairStatus.className = 'status connecting';
            pairStatus.innerHTML = 'Generating pairing code...';
            sessionCode.style.display = 'none';

            try {
                const response = await fetch('/api/pair', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ number: phoneNumber })
                });

                const data = await response.json();

                if (data.success) {
                    pairStatus.className = 'status success';
                    pairStatus.innerHTML = 'Pairing code generated successfully!';
                    sessionCode.innerHTML = 'CODE: ' + data.code;
                    sessionCode.style.display = 'block';
                } else {
                    throw new Error(data.error || 'Failed to generate pairing code');
                }
            } catch (error) {
                pairStatus.className = 'status error';
                pairStatus.innerHTML = 'Error: ' + error.message;
            } finally {
                pairBtn.disabled = false;
                pairBtn.innerHTML = 'Generate Pairing Code';
            }
        }

        // Auto-generate QR on page load
        window.onload = generateQR;
    </script>
</body>
</html>
`;

// Utility function to generate random ID
function makeid(length = 8) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

// Cleanup function
function removeSession(sessionId) {
    const sessionPath = `./sessions/${sessionId}`;
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }
    sessions.delete(sessionId);
}

// Routes
app.get('/', (req, res) => {
    res.send(HTML_TEMPLATE);
});

// QR Code Generation
app.get('/api/qr', async (req, res) => {
    const sessionId = makeid();
    const sessionPath = `./sessions/${sessionId}`;

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Safari')
        });

        sessions.set(sessionId, { sock, saveCreds });

        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, qr } = update;
            
            if (qr) {
                // QR is already handled by the initial response
            }

            if (connection === 'open') {
                console.log(`✅ Session ${sessionId} connected`);
                
                // Send success message
                await sock.sendMessage(sock.user.id, {
                    text: `🚀 TRI CONTROLS BOT - Session Connected!\n\nSession ID: ${sessionId}\n\nPowered by TRI MSTR DEV STUDIO`
                });

                // Cleanup after delay
                setTimeout(() => {
                    sock.ws.close();
                    removeSession(sessionId);
                }, 5000);
            }

            if (connection === 'close') {
                removeSession(sessionId);
            }
        });

        // Generate QR code
        sock.ev.on('connection.update', async (update) => {
            if (update.qr) {
                try {
                    const qrBuffer = await QRCode.toBuffer(update.qr);
                    res.setHeader('Content-Type', 'image/png');
                    res.send(qrBuffer);
                } catch (error) {
                    res.status(500).json({ error: 'QR generation failed' });
                }
            }
        });

        // Timeout for QR generation
        setTimeout(() => {
            if (!res.headersSent) {
                res.status(408).json({ error: 'QR generation timeout' });
            }
        }, 30000);

    } catch (error) {
        console.error('QR generation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Pairing Code Generation
app.post('/api/pair', async (req, res) => {
    const { number } = req.body;
    const sessionId = makeid();
    const sessionPath = `./sessions/${sessionId}`;

    if (!number) {
        return res.status(400).json({ success: false, error: 'Phone number required' });
    }

    try {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: state.keys,
            },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS('Safari')
        });

        sessions.set(sessionId, { sock, saveCreds });

        sock.ev.on('creds.update', saveCreds);

        if (!sock.authState.creds.registered) {
            await delay(1500);
            const cleanNumber = number.replace(/[^0-9]/g, '');
            const code = await sock.requestPairingCode(cleanNumber);
            
            sock.ev.on('connection.update', async (update) => {
                if (update.connection === 'open') {
                    console.log(`✅ Paired session ${sessionId}`);
                    
                    await sock.sendMessage(sock.user.id, {
                        text: `🔐 TRI CONTROLS BOT - Paired Successfully!\n\nYour number: ${number}\nSession ID: ${sessionId}\n\nDeveloped by GHOSTTRI - TRI MSTR DEV STUDIO`
                    });

                    setTimeout(() => {
                        sock.ws.close();
                        removeSession(sessionId);
                    }, 5000);
                }
            });

            return res.json({ success: true, code });
        }

    } catch (error) {
        console.error('Pairing error:', error);
        removeSession(sessionId);
        res.status(500).json({ success: false, error: 'Pairing failed' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'TRI CONTROLS BOT',
        developer: 'GHOSTTRI',
        company: 'TRI MSTR DEV STUDIO'
    });
});

// Ensure sessions directory exists
if (!fs.existsSync('./sessions')) {
    fs.mkdirSync('./sessions', { recursive: true });
}

// Cleanup on exit
process.on('SIGINT', () => {
    console.log('🔄 Cleaning up sessions...');
    sessions.forEach((session, sessionId) => {
        removeSession(sessionId);
    });
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`
🚀 TRI CONTROLS BOT - Session Generator
📍 Port: ${PORT}
👨‍💻 Developer: GHOSTTRI
🏢 Company: TRI MSTR DEV STUDIO
📧 Service: WhatsApp Session Generator
✅ Server running: http://localhost:${PORT}
    `);
});

module.exports = app;
