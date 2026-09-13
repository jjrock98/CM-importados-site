import { z } from 'zod';

export const loginSchema = z.object({
  email:    z.string().email('Email inválido').max(255),
  // ⚠️ A propósito se deja en 6 acá (no se sube): es solo login, no fija
  // contraseña nueva. Subirlo bloquearía a cuentas ya creadas con una
  // contraseña de 6-7 caracteres — el mínimo real se exige donde se
  // define la contraseña (registro / cambio de contraseña, abajo).
  password: z.string().min(6, 'Mínimo 6 caracteres').max(128),
});

// ✅ FIX: contraseña nueva ahora pide 8 caracteres mínimo (antes 6, muy
// corto — más fácil de forzar por fuerza bruta/diccionario). Solo afecta
// cuentas nuevas: no rompe el login de nadie que ya tenga una más corta.
export const registerSchema = loginSchema.extend({
  nombre:   z.string().min(2, 'Mínimo 2 caracteres').max(100),
  password: z.string().min(8, 'Mínimo 8 caracteres').max(128),
});

export const resetPasswordSchema   = z.object({ email: z.string().email() });
export const updatePasswordSchema  = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres').max(128), confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, { message: 'Las contraseñas no coinciden', path: ['confirmPassword'] });

export const profileSchema = z.object({
  nombre: z.string().min(2).max(100).optional(),
  direccion: z.string().min(5).max(200), ciudad: z.string().min(2).max(100),
  codigo_postal: z.string().min(3).max(10), telefono: z.string().min(7).max(20),
});

export const profileUpdateSchema = z.object({
  nombre:        z.string().min(2).max(100).trim().optional(),
  telefono:      z.string().min(7).max(20).trim().optional(),
  direccion:     z.string().min(5).max(200).trim().optional(),
  ciudad:        z.string().min(2).max(100).trim().optional(),
  codigo_postal: z.string().min(3).max(10).trim().optional(),
});

export const contactMessageSchema = z.object({
  nombre:  z.string().min(2, 'Nombre requerido').max(100).trim(),
  email:   z.string().email('Email inválido').max(255).trim().toLowerCase(),
  asunto:  z.string().max(200).trim().optional(),
  mensaje: z.string().min(10, 'Mínimo 10 caracteres').max(2000).trim(),
});

export const orderItemSchema = z.object({
  product_id:     z.string().uuid('product_id inválido'),
  tipo_pack:      z.enum(['media_docena', 'docena', 'unidad']),
  cantidad_packs: z.number().int().min(1).max(200),  // max 200 para minorista en volumen
  variant_id:     z.string().uuid().nullable().optional(),
});

// ✅ FIX: tipo_entrega added to checkoutFormSchema
export const checkoutFormSchema = z.object({
  nombre:        z.string().min(2).max(100).trim(),
  email:         z.string().email().max(255).trim().toLowerCase(),
  telefono:      z.string().min(7).max(20).trim(),
  direccion:     z.string().max(200).trim().default(''),
  ciudad:        z.string().max(100).trim().default(''),
  codigo_postal: z.string().max(10).trim().default(''),
  notas:         z.string().max(500).trim().optional(),
  metodo_pago:   z.enum(['mercadopago', 'transferencia', 'cuenta_corriente', 'efectivo']),
  tipo_entrega:  z.enum(['envio', 'retiro', 'micro']).default('envio'), // ✅ NEW: 'micro'
  // ── Retiro en local: identidad de quien retira ──────────────────────
  retiro_dni_titular:    z.string().max(20).trim().optional().default(''),
  retiro_retira_tercero: z.boolean().optional().default(false),
  retiro_tercero_nombre: z.string().max(100).trim().optional().default(''),
  retiro_tercero_dni:    z.string().max(20).trim().optional().default(''),
  // ── Entrega en micros (solo La Salada) ──────────────────────────────
  micro_terminal:            z.enum(['punta_mogote', 'urkupinia', 'ocean']).nullable().optional(),
  micro_empresa_transporte:  z.string().max(150).trim().optional().default(''),
  micro_nombre_recibe:       z.string().max(100).trim().optional().default(''),
}).superRefine((data, ctx) => {
  // ── Efectivo: solo válido para retiro en local o entrega en micro ────
  // (defensa en profundidad — la UI ya no debería permitir esta
  // combinación, pero se valida también acá por si llega una request
  // directa a la API).
  if (data.metodo_pago === 'efectivo' && data.tipo_entrega === 'envio') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El pago en efectivo no está disponible para envío a domicilio',
      path: ['metodo_pago'],
    });
  }

  if (data.tipo_entrega === 'retiro') {
    if (!data.retiro_dni_titular || data.retiro_dni_titular.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'DNI/documento requerido para retiro en local (mínimo 6 caracteres)',
        path: ['retiro_dni_titular'],
      });
    }

    if (data.retiro_retira_tercero) {
      if (!data.retiro_tercero_nombre || data.retiro_tercero_nombre.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Nombre de la persona que retira es requerido',
          path: ['retiro_tercero_nombre'],
        });
      }
      if (!data.retiro_tercero_dni || data.retiro_tercero_dni.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DNI de la persona que retira es requerido (mínimo 6 caracteres)',
          path: ['retiro_tercero_dni'],
        });
      }
    }
  }

  if (data.tipo_entrega === 'micro') {
    // Solo efectivo o transferencia — no tiene sentido Mercado Pago/cuenta
    // corriente acá y el negocio decidió no ofrecerlos para este canal.
    if (!['efectivo', 'transferencia'].includes(data.metodo_pago)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Para entrega en micro solo se puede pagar por transferencia o efectivo',
        path: ['metodo_pago'],
      });
    }
    if (!data.micro_terminal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Elegí la terminal de micros',
        path: ['micro_terminal'],
      });
    }
    if (!data.micro_empresa_transporte || data.micro_empresa_transporte.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indicá el nombre del micro y/o la empresa de transporte',
        path: ['micro_empresa_transporte'],
      });
    }
    if (!data.micro_nombre_recibe || data.micro_nombre_recibe.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indicá el nombre de quien recibe el pedido',
        path: ['micro_nombre_recibe'],
      });
    }
  }
});

export const createOrderSchema = z.object({
  items:       z.array(orderItemSchema).min(1, 'El carrito está vacío').max(50),
  formData:    checkoutFormSchema,
  subtotal:    z.number().positive().max(9_999_999),
  costo_envio: z.number().min(0).max(99_999),
  total:       z.number().positive().max(9_999_999),
});

export const productSchema = z.object({
  nombre:              z.string().min(2).max(200).trim(),
  slug:                z.string().min(2).max(200).regex(/^[a-z0-9-]+$/, 'Solo letras minúsculas, números y guiones'),
  descripcion:         z.string().max(2000).trim().optional().nullable(),
  descripcion_corta:   z.string().max(300).trim().optional().nullable(),
  imagenes:            z.array(z.string().url()).max(10),
  stock_unidades:      z.number().int().min(0).max(100_000),
  precio_media_docena: z.number().min(0).max(9_999_999).nullable().optional(),
  precio_docena:       z.number().min(0).max(9_999_999),
  colores:             z.array(z.string().max(50)).max(20),
  talles:              z.array(z.string().max(20)).max(20),
  activo:              z.boolean(),
  destacado:           z.boolean(),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().uuid(),
  estado:  z.enum(['pendiente','pagado','procesando','enviado','entregado','cancelado','rechazado']),
});

export const uploadComprobanteSchema = z.object({
  orderId: z.string().uuid(), comprobanteUrl: z.string().url(),
});

export function parseBody<T>(
  schema: z.ZodSchema<T>, data: unknown
): { data: T; error: null } | { data: null; error: string } {
  const result = schema.safeParse(data);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    return { data: null, error: msg };
  }
  return { data: result.data, error: null };
}