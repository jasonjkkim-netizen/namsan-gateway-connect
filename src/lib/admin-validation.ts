import { z } from 'zod';

// Common validation patterns
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const youtubeUrlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/;

// Investment validation schema
export const investmentSchema = z.object({
  user_id: z.string().uuid({ message: 'Invalid client selection' }),
  product_name_en: z.string()
    .min(1, 'English product name is required')
    .max(255, 'Product name must be less than 255 characters'),
  product_name_ko: z.string()
    .min(1, 'Korean product name is required')
    .max(255, 'Product name must be less than 255 characters'),
  investment_amount: z.number()
    .positive('Investment amount must be positive')
    .max(999999999999, 'Amount too large'),
  current_value: z.number()
    .positive('Current value must be positive')
    .max(999999999999, 'Value too large'),
  start_date: z.string().regex(datePattern, 'Invalid date format'),
  maturity_date: z.string().regex(datePattern, 'Invalid date format').nullable().optional(),
  expected_return: z.number().min(0, 'Return must be non-negative').max(100, 'Return cannot exceed 100%').nullable().optional(),
  status: z.enum(['active', 'matured', 'pending', 'closed']),
}).refine((data) => {
  if (data.maturity_date && data.start_date) {
    return new Date(data.maturity_date) > new Date(data.start_date);
  }
  return true;
}, { message: 'Maturity date must be after start date', path: ['maturity_date'] });

// Product validation schema
export const productSchema = z.object({
  name_en: z.string()
    .min(1, 'English name is required')
    .max(255, 'Name must be less than 255 characters'),
  name_ko: z.string()
    .min(1, 'Korean name is required')
    .max(255, 'Name must be less than 255 characters'),
  type: z.enum(['bond', 'equity', 'fund', 'real_estate', 'alternative']),
  description_en: z.string().max(2000, 'Description too long').nullable().optional(),
  description_ko: z.string().max(2000, 'Description too long').nullable().optional(),
  target_return: z.number().min(0, 'Return must be non-negative').max(100, 'Return cannot exceed 100%').nullable().optional(),
  minimum_investment: z.number().positive('Minimum investment must be positive').max(999999999999, 'Amount too large').nullable().optional(),
  募集_deadline: z.string().regex(datePattern, 'Invalid date format').nullable().optional(),
  status: z.enum(['open', 'closed', 'coming_soon']),
  is_active: z.boolean(),
});

// Video validation schema
export const videoSchema = z.object({
  title_en: z.string()
    .min(1, 'English title is required')
    .max(255, 'Title must be less than 255 characters'),
  title_ko: z.string()
    .min(1, 'Korean title is required')
    .max(255, 'Title must be less than 255 characters'),
  category: z.enum(['market_commentary', 'product_explanation', 'educational']),
  description_en: z.string().max(2000, 'Description too long').nullable().optional(),
  description_ko: z.string().max(2000, 'Description too long').nullable().optional(),
  youtube_url: z.string()
    .min(1, 'YouTube URL is required')
    .regex(youtubeUrlPattern, 'Must be a valid YouTube URL (youtube.com/watch?v= or youtu.be/)'),
  thumbnail_url: z.string().url('Invalid URL format').nullable().optional().or(z.literal('')),
  is_active: z.boolean(),
});

// Client profile validation schema
export const clientProfileSchema = z.object({
  full_name: z.string()
    .min(1, 'English name is required')
    .max(100, 'Name must be less than 100 characters'),
  full_name_ko: z.string().max(100, 'Name must be less than 100 characters').nullable().optional(),
  phone: z.string()
    .regex(/^[+]?[\d\s\-()]+$/, 'Invalid phone number format')
    .max(20, 'Phone number too long')
    .nullable()
    .optional()
    .or(z.literal('')),
  address: z.string().max(500, 'Address too long').nullable().optional(),
  preferred_language: z.enum(['en', 'ko']),
});

// Research report validation schema
export const researchSchema = z.object({
  title_en: z.string()
    .min(1, 'English title is required')
    .max(255, 'Title must be less than 255 characters'),
  title_ko: z.string()
    .min(1, 'Korean title is required')
    .max(255, 'Title must be less than 255 characters'),
  category: z.enum(['market_update', 'product_analysis', 'economic_outlook']),
  summary_en: z.string().max(2000, 'Summary too long').nullable().optional(),
  summary_ko: z.string().max(2000, 'Summary too long').nullable().optional(),
  pdf_url: z.string().url('Invalid URL format').nullable().optional().or(z.literal('')),
  publication_date: z.string().regex(datePattern, 'Invalid date format'),
  is_active: z.boolean(),
});

// Helper function to parse form data with validation
export function validateFormData<T>(
  schema: z.ZodSchema<T>,
  data: Record<string, unknown>,
  language: string
): { success: true; data: T; error?: never } | { success: false; error: string; data?: never } {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const firstError = result.error.errors[0];
    return {
      success: false,
      error: language === 'ko' 
        ? translateError(firstError.message) 
        : firstError.message,
    };
  }
  
  return { success: true, data: result.data };
}

// Translate common error messages to Korean
function translateError(message: string): string {
  const translations: Record<string, string> = {
    'Invalid client selection': '유효하지 않은 고객 선택',
    'English product name is required': '영문 상품명은 필수입니다',
    'Korean product name is required': '한글 상품명은 필수입니다',
    'Product name must be less than 255 characters': '상품명은 255자 이내여야 합니다',
    'Investment amount must be positive': '투자금액은 양수여야 합니다',
    'Current value must be positive': '현재가치는 양수여야 합니다',
    'Amount too large': '금액이 너무 큽니다',
    'Value too large': '값이 너무 큽니다',
    'Invalid date format': '잘못된 날짜 형식',
    'Return must be non-negative': '수익률은 0 이상이어야 합니다',
    'Return cannot exceed 100%': '수익률은 100%를 초과할 수 없습니다',
    'Maturity date must be after start date': '만기일은 시작일 이후여야 합니다',
    'English name is required': '영문 이름은 필수입니다',
    'Korean name is required': '한글 이름은 필수입니다',
    'Name must be less than 100 characters': '이름은 100자 이내여야 합니다',
    'Name must be less than 255 characters': '이름은 255자 이내여야 합니다',
    'Minimum investment must be positive': '최소투자금은 양수여야 합니다',
    'English title is required': '영문 제목은 필수입니다',
    'Korean title is required': '한글 제목은 필수입니다',
    'Title must be less than 255 characters': '제목은 255자 이내여야 합니다',
    'Description too long': '설명이 너무 깁니다',
    'Summary too long': '요약이 너무 깁니다',
    'YouTube URL is required': 'YouTube URL은 필수입니다',
    'Must be a valid YouTube URL (youtube.com/watch?v= or youtu.be/)': '유효한 YouTube URL이어야 합니다',
    'Invalid URL format': '잘못된 URL 형식',
    'Invalid phone number format': '잘못된 전화번호 형식',
    'Phone number too long': '전화번호가 너무 깁니다',
    'Address too long': '주소가 너무 깁니다',
  };
  
  return translations[message] || message;
}

// Bulk import validation helper
export function validateBulkImportRow<T>(
  schema: z.ZodSchema<T>,
  row: Record<string, unknown>,
  rowIndex: number
): { success: true; data: T; error?: never; rowIndex?: never } | { success: false; error: string; rowIndex: number; data?: never } {
  const result = schema.safeParse(row);
  
  if (!result.success) {
    const firstError = result.error.errors[0];
    return {
      success: false,
      error: `Row ${rowIndex + 1}: ${firstError.path.join('.')} - ${firstError.message}`,
      rowIndex,
    };
  }
  
  return { success: true, data: result.data };
}
