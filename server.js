import express from 'express';
import cors from 'cors';
import pg from 'pg';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ServiceSchema, validateImageFile, sanitizeInput, rateLimiter } from './utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;
const app = express();
const PORT = process.env.PORT || 5001;

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'inclui',
    password: process.env.DB_PASSWORD || 'admin123',
    port: parseInt(process.env.DB_PORT || '5432'),
    ssl: process.env.DB_HOST && process.env.DB_HOST !== 'localhost' ? { rejectUnauthorized: false } : false
});

const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(rateLimiter());

// Configuração do Multer com validação de segurança
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const validation = validateImageFile(file);
    if (validation.valid) {
        cb(null, true);
    } else {
        cb(new Error(validation.error), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 10
    },
    fileFilter: fileFilter
});

// Init DB for Services, Materials, Equipment
const initDb = async () => {
    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS servicos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo TEXT NOT NULL,
        descricao TEXT,
        localizacao TEXT,
        gravidade INTEGER CHECK (gravidade BETWEEN 1 AND 5),
        urgencia INTEGER CHECK (urgencia BETWEEN 1 AND 5),
        tendencia INTEGER CHECK (tendencia BETWEEN 1 AND 5),
        prioridade INTEGER GENERATED ALWAYS AS (gravidade * urgencia * tendencia) STORED,
        foto_url TEXT,
        status TEXT DEFAULT 'Pendente',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
        console.log('📦 Tabela de serviços (iNFRA) verificada/criada.');

        // Create Materials Table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS materiais (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category TEXT,
        quantity INTEGER DEFAULT 0,
        unit TEXT,
        location TEXT,
        status TEXT DEFAULT 'OK',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
        console.log('📦 Tabela de materiais verificada/criada.');

        // Create Equipment Table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS equipamentos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT DEFAULT 'MAQUINA',
        status TEXT DEFAULT 'DISPONIVEL',
        condition INTEGER DEFAULT 100,
        location TEXT,
        current_service_id TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
        console.log('📦 Tabela de equipamentos verificada/criada.');

        // Create Allocations Table
        await pool.query(`
      CREATE TABLE IF NOT EXISTS alocacoes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        equipment_id UUID REFERENCES equipamentos(id),
        service_id TEXT,
        service_name TEXT,
        start_date DATE,
        end_date DATE,
        status TEXT DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
        console.log('📦 Tabela de alocações verificada/criada.');

        // Seed Data if empty
        const materialsCount = await pool.query('SELECT COUNT(*) FROM materiais');
        if (parseInt(materialsCount.rows[0].count) === 0) {
            console.log('🌱 Seeding materials...');
            await pool.query(`
                INSERT INTO materiais (name, quantity, unit, category, status, location) VALUES
                ('Cimento CP-II', 450, 'sc', 'Alvenaria', 'OK', 'Depósito Central'),
                ('Tijolo Cerâmico 8 furos', 12000, 'un', 'Alvenaria', 'OK', 'Canteiro Setor 3'),
                ('Areia Média', 12, 'm³', 'Insumos', 'BAIXO', 'Depósito Central'),
                ('Aço CA-50 10mm', 80, 'barras', 'Ferragem', 'CRITICO', 'Depósito Central'),
                ('Tinta Acrílica Branca', 18, 'latas', 'Pintura', 'OK', 'Almoxarifado'),
                ('Cabo Flexível 2.5mm', 400, 'm', 'Elétrica', 'OK', 'Almoxarifado');
            `);
        }

        const equipmentCount = await pool.query('SELECT COUNT(*) FROM equipamentos');
        if (parseInt(equipmentCount.rows[0].count) === 0) {
            console.log('🌱 Seeding equipment...');
            await pool.query(`
                INSERT INTO equipamentos (name, type, status, condition, location, current_service_id) VALUES
                ('Retroescavadeira CAT 416', 'MAQUINA', 'EM_USO', 85, 'Drenagem Base Sul', 'S-101'),
                ('Caminhão Caçamba MB 2726', 'VEICULO', 'DISPONIVEL', 92, 'Pátio Central', NULL),
                ('Betoneira 400L', 'MAQUINA', 'MANUTENCAO', 45, 'Oficina Mecânica', NULL),
                ('Compactador de Solo (Sapo)', 'FERRAMENTA', 'EM_USO', 70, 'Pavimentação Norte', 'S-102'),
                ('Gerador Diesel 50kVA', 'MAQUINA', 'DISPONIVEL', 98, 'Pátio Central', NULL),
                ('Serra Circular de Bancada', 'FERRAMENTA', 'DISPONIVEL', 80, 'Carpintaria', NULL);
            `);
        }

        // Seed Allocations
        const allocationsCount = await pool.query('SELECT COUNT(*) FROM alocacoes');
        if (parseInt(allocationsCount.rows[0].count) === 0) {
            const retro = await pool.query("SELECT id FROM equipamentos WHERE name = 'Retroescavadeira CAT 416' LIMIT 1");
            const sapo = await pool.query("SELECT id FROM equipamentos WHERE name = 'Compactador de Solo (Sapo)' LIMIT 1");

            if (retro.rows.length > 0 && sapo.rows.length > 0) {
                console.log('🌱 Seeding allocations...');
                await pool.query(`
                    INSERT INTO alocacoes (equipment_id, service_id, service_name, start_date, end_date, status) VALUES
                    ($1, 'S-101', 'Drenagem Base Sul', '2024-02-01', '2024-02-15', 'ACTIVE'),
                    ($2, 'S-102', 'Pavimentação Norte', '2024-02-05', '2024-02-10', 'ACTIVE')
                 `, [retro.rows[0].id, sapo.rows[0].id]);
            }
        }

    } catch (error) {
        console.error('Erro ao inicializar DB:', error);
    }
};

initDb();

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend iNFRA operacional' });
});

// --- Endpoints de Serviços ---

app.get('/api/servicos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM servicos ORDER BY prioridade DESC, created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar serviços:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/servicos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM servicos WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar serviço:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/servicos', upload.single('foto'), async (req, res) => {
    try {
        const validation = ServiceSchema.validate(req.body);

        if (!validation.valid) {
            return res.status(400).json({ error: 'Dados inválidos', details: validation.errors });
        }

        const servico = validation.data;
        const fotoUrl = req.file ? `/uploads/${req.file.filename}` : null;

        const result = await pool.query(
            `INSERT INTO servicos (titulo, descricao, localizacao, gravidade, urgencia, tendencia, foto_url, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [servico.titulo, servico.descricao, servico.localizacao, servico.gravidade, servico.urgencia, servico.tendencia, fotoUrl, servico.status]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao criar serviço:', error);

        if (req.file) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({ error: error.message });
    }
});

app.put('/api/servicos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const validation = ServiceSchema.validate(req.body);

        if (!validation.valid) {
            return res.status(400).json({ error: 'Dados inválidos', details: validation.errors });
        }

        const servico = validation.data;
        const result = await pool.query(
            `UPDATE servicos SET titulo = $1, descricao = $2, localizacao = $3, 
       gravidade = $4, urgencia = $5, tendencia = $6, status = $7, updated_at = NOW()
       WHERE id = $8 RETURNING *`,
            [servico.titulo, servico.descricao, servico.localizacao, servico.gravidade, servico.urgencia, servico.tendencia, servico.status, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Serviço não encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar serviço:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/servicos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM servicos WHERE id = $1', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar serviço:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Endpoints de Materiais ---

app.get('/api/materiais', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM materiais ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar materiais:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/materiais', async (req, res) => {
    try {
        const { name, category, quantity, unit, location, status } = req.body;
        const result = await pool.query(
            `INSERT INTO materiais (name, category, quantity, unit, location, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name, category, quantity, unit, location, status]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao criar material:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/materiais/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, category, quantity, unit, location, status } = req.body;
        const result = await pool.query(
            `UPDATE materiais SET name = $1, category = $2, quantity = $3, unit = $4, location = $5, status = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
            [name, category, quantity, unit, location, status, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Material não encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar material:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/materiais/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM materiais WHERE id = $1', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar material:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Endpoints de Equipamentos ---

app.get('/api/equipamentos', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM equipamentos ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar equipamentos:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/equipamentos', async (req, res) => {
    try {
        const { name, type, status, condition, location, current_service_id } = req.body;
        const result = await pool.query(
            `INSERT INTO equipamentos (name, type, status, condition, location, current_service_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name, type, status, condition, location, current_service_id]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao criar equipamento:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/equipamentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, status, condition, location, current_service_id } = req.body;
        const result = await pool.query(
            `UPDATE equipamentos SET name = $1, type = $2, status = $3, condition = $4, location = $5, current_service_id = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
            [name, type, status, condition, location, current_service_id, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Equipamento não encontrado' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar equipamento:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/equipamentos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM equipamentos WHERE id = $1', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar equipamento:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Endpoint para Upload de Fotos via WhatsApp ---
app.post('/api/whatsapp/photos', upload.array('photos', 10), async (req, res) => {
    try {
        const { serviceId, phaseId, phoneNumber } = req.body;

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'Nenhuma foto foi enviada' });
        }

        const photoUrls = req.files.map(file => `/uploads/${file.filename}`);

        console.log(`📸 Fotos recebidas via WhatsApp de ${phoneNumber}:`, {
            serviceId,
            phaseId,
            count: photoUrls.length,
            urls: photoUrls
        });

        res.status(201).json({
            success: true,
            message: `${photoUrls.length} foto(s) enviada(s) com sucesso`,
            photos: photoUrls,
            serviceId,
            phaseId
        });
    } catch (error) {
        console.error('Erro ao processar fotos do WhatsApp:', error);
        res.status(500).json({ error: error.message });
    }
});

// Webhook para receber mensagens do WhatsApp (integração futura com WhatsApp Business API)
app.post('/api/whatsapp/webhook', async (req, res) => {
    try {
        const { from, mediaUrl, caption } = req.body;

        console.log('📱 Mensagem recebida do WhatsApp:', { from, mediaUrl, caption });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Erro no webhook do WhatsApp:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Endpoints de Alocações (Escalonamento) ---

app.get('/api/alocacoes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM alocacoes ORDER BY start_date DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar alocações:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/alocacoes', async (req, res) => {
    try {
        const { equipment_id, service_id, service_name, start_date, end_date, status } = req.body;
        const result = await pool.query(
            `INSERT INTO alocacoes (equipment_id, service_id, service_name, start_date, end_date, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [equipment_id, service_id, service_name, start_date, end_date, status]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao criar alocação:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/alocacoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { equipment_id, service_id, service_name, start_date, end_date, status } = req.body;
        const result = await pool.query(
            `UPDATE alocacoes SET equipment_id = $1, service_id = $2, service_name = $3, start_date = $4, end_date = $5, status = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
            [equipment_id, service_id, service_name, start_date, end_date, status, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alocação não encontrada' });
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao atualizar alocação:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/alocacoes/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM alocacoes WHERE id = $1', [id]);
        res.status(204).send();
    } catch (error) {
        console.error('Erro ao deletar alocação:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Backend iNFRA rodando na porta ${PORT}`);
    console.log(`📊 Database Connected: ${process.env.DB_NAME || 'inclui'}`);
    console.log(`📸 Upload de fotos via WhatsApp habilitado`);
});
