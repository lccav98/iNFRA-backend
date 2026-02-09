// Validation Schemas
export const ServiceSchema = {
  validate: (data) => {
    const errors = [];
    
    if (!data.titulo || data.titulo.length < 3 || data.titulo.length > 200) {
      errors.push('Título deve ter entre 3 e 200 caracteres');
    }
    
    if (data.descricao && data.descricao.length > 1000) {
      errors.push('Descrição muito longa (máx 1000 caracteres)');
    }
    
    if (!data.localizacao || data.localizacao.length < 3) {
      errors.push('Localização inválida');
    }
    
    const gravidade = parseInt(data.gravidade);
    if (isNaN(gravidade) || gravidade < 1 || gravidade > 5) {
      errors.push('Gravidade deve ser entre 1 e 5');
    }
    
    const urgencia = parseInt(data.urgencia);
    if (isNaN(urgencia) || urgencia < 1 || urgencia > 5) {
      errors.push('Urgência deve ser entre 1 e 5');
    }
    
    const tendencia = parseInt(data.tendencia);
    if (isNaN(tendencia) || tendencia < 1 || tendencia > 5) {
      errors.push('Tendência deve ser entre 1 e 5');
    }
    
    const validStatuses = ['Pendente', 'Em Andamento', 'Concluído', 'Cancelado'];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push('Status inválido');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      data: errors.length === 0 ? {
        titulo: sanitizeInput(data.titulo),
        descricao: sanitizeInput(data.descricao || ''),
        localizacao: sanitizeInput(data.localizacao),
        gravidade,
        urgencia,
        tendencia,
        status: data.status || 'Pendente'
      } : null
    };
  }
};

export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[<>]/g, '')
    .substring(0, 500);
}

export function validateImageFile(file) {
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!file) {
    return { valid: false, error: 'Nenhum arquivo fornecido' };
  }

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return { valid: false, error: 'Tipo de arquivo não permitido. Use JPG, PNG ou WEBP.' };
  }

  if (file.size > maxSize) {
    return { valid: false, error: 'Arquivo muito grande. Máximo 5MB.' };
  }

  const ext = file.originalname.split('.').pop()?.toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) {
    return { valid: false, error: 'Extensão de arquivo inválida.' };
  }

  return { valid: true };
}

export function rateLimiter() {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minuto
    const maxRequests = 100;
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const userRequests = requests.get(ip);
    const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({ error: 'Muitas requisições. Tente novamente em 1 minuto.' });
    }
    
    recentRequests.push(now);
    requests.set(ip, recentRequests);
    
    next();
  };
}
