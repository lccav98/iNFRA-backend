import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'inclui',
    password: process.env.DB_PASSWORD || 'admin123',
    port: parseInt(process.env.DB_PORT || '5432'),
});

const checkDb = async () => {
    try {
        const matCount = await pool.query('SELECT COUNT(*) FROM materiais');
        const eqCount = await pool.query('SELECT COUNT(*) FROM equipamentos');

        console.log(`Materiais count: ${matCount.rows[0].count}`);
        console.log(`Equipamentos count: ${eqCount.rows[0].count}`);

        const materials = await pool.query('SELECT * FROM materiais LIMIT 5');
        console.log('Sample Materials:', materials.rows);

    } catch (error) {
        console.error('Error checking DB:', error);
    } finally {
        await pool.end();
    }
};

checkDb();
