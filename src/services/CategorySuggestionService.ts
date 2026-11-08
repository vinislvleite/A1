import { Category } from '../domain/entities/Category';
import { Transaction } from '../domain/entities/Transaction';
import { CategoryRepository } from '../data/repositories/CategoryRepository';
import { TransactionRepository } from '../data/repositories/TransactionRepository';

export function normalizeSuggestionText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s*\(\d+\/\d+\)$/, '')
    .trim();
}

const KEYWORD_DICTIONARY: Record<string, string[]> = {
  alimentacao: [
    'supermercado',
    'mercado',
    'atacadao',
    'assai',
    'carrefour',
    'ifood',
    'rappi',
    'restaurante',
    'padaria',
    'lanche',
    'hamburguer',
    'pizza',
    'pizzaria',
    'acougue',
    'hortifruti',
    'cafe',
    'almoco',
    'jantar',
    'sorveteria',
    'sushi',
    'churrasco',
  ],
  transporte: [
    'uber',
    '99pop',
    '99taxi',
    'taxi',
    'gasolina',
    'combustivel',
    'etanol',
    'diesel',
    'posto',
    'ipiranga',
    'shell',
    'onibus',
    'metro',
    'trem',
    'bilhete',
    'passagem',
    'pedagio',
    'estacionamento',
    'oficina',
    'mecanico',
    'ipva',
  ],
  saude: [
    'farmacia',
    'drogaria',
    'drogasil',
    'raia',
    'panvel',
    'remedio',
    'medicamento',
    'medico',
    'consulta',
    'exame',
    'laboratorio',
    'hospital',
    'clinica',
    'dentista',
    'odonto',
    'psicologo',
    'terapia',
    'unimed',
    'academia',
    'smartfit',
  ],
  moradia: [
    'aluguel',
    'condominio',
    'luz',
    'energia',
    'enel',
    'cpfl',
    'cemig',
    'agua',
    'sabesp',
    'sanepar',
    'copasa',
    'gas',
    'comgas',
    'internet',
    'fibra',
    'vivo',
    'claro',
    'tim',
    'iptu',
    'reforma',
    'manutencao',
    'condominio',
  ],
  lazer: [
    'cinema',
    'ingresso',
    'netflix',
    'spotify',
    'disney',
    'prime video',
    'hbo',
    'youtube',
    'steam',
    'playstation',
    'xbox',
    'nintendo',
    'jogo',
    'game',
    'viagem',
    'hotel',
    'airbnb',
    'pousada',
    'passeio',
    'show',
    'teatro',
    'festa',
  ],
  educacao: [
    'curso',
    'faculdade',
    'universidade',
    'escola',
    'colegio',
    'mensalidade',
    'livro',
    'livraria',
    'apostila',
    'papelaria',
    'udemy',
    'alura',
    'ingles',
    'idioma',
    'pos-graduacao',
    'mestrado',
    'matricula',
  ],
  salario: [
    'salario',
    'pagamento',
    'holerite',
    'adiantamento',
    'decimo terceiro',
    'ferias',
    'plr',
    'bonus',
    'pro-labore',
    'remuneracao',
  ],
  servicos: [
    'freela',
    'freelance',
    'consultoria',
    'servico',
    'projeto',
    'honorario',
    'comissao',
    'bico',
    'cliente',
  ],
};

export function suggestCategoryFromData(
  description: string,
  categories: Category[],
  recentTransactions: Transaction[]
): Category | null {
  const normalizedInput = normalizeSuggestionText(description);
  if (normalizedInput.length < 2 || categories.length === 0) {
    return null;
  }

  const categoryById = new Map<string, Category>();
  const categoryByNormalizedName = new Map<string, Category>();
  for (const cat of categories) {
    categoryById.set(cat.id, cat);
    categoryByNormalizedName.set(normalizeSuggestionText(cat.name), cat);
  }

  for (const tx of recentTransactions) {
    const txDesc = normalizeSuggestionText(tx.description);
    if (!txDesc) continue;
    if (txDesc === normalizedInput) {
      const matchedCat = categoryById.get(tx.category_id);
      if (matchedCat) return matchedCat;
    }
  }

  if (normalizedInput.length >= 3) {
    for (const tx of recentTransactions) {
      const txDesc = normalizeSuggestionText(tx.description);
      if (!txDesc) continue;
      if (txDesc.includes(normalizedInput) || normalizedInput.includes(txDesc)) {
        const matchedCat = categoryById.get(tx.category_id);
        if (matchedCat) return matchedCat;
      }
    }
  }

  const inputWords = normalizedInput.split(/\s+/);

  for (const cat of categories) {
    if (!cat.is_custom) continue;
    const normName = normalizeSuggestionText(cat.name);
    if (normName.length >= 3 && normalizedInput.includes(normName)) {
      return cat;
    }
    if (cat.description) {
      const descTokens = normalizeSuggestionText(cat.description)
        .split(/[,.\s]+/)
        .filter((t) => t.length >= 4);
      if (descTokens.some((tok) => normalizedInput.includes(tok))) {
        return cat;
      }
    }
  }

  for (const [normCatName, keywords] of Object.entries(KEYWORD_DICTIONARY)) {
    const matchedKeyword = keywords.some((kw) => {
      if (kw.includes(' ')) {
        return normalizedInput.includes(kw);
      }
      return inputWords.some((w) => w === kw || (w.length >= 4 && (w.startsWith(kw) || kw.startsWith(w))));
    });

    if (matchedKeyword) {
      const targetCategory = categoryByNormalizedName.get(normCatName);
      if (targetCategory) {
        return targetCategory;
      }
    }
  }

  for (const cat of categories) {
    const normName = normalizeSuggestionText(cat.name);
    if (normName.length >= 3 && normalizedInput.includes(normName)) {
      return cat;
    }
    if (cat.description) {
      const descTokens = normalizeSuggestionText(cat.description)
        .split(/[,.\s]+/)
        .filter((t) => t.length >= 4);
      if (descTokens.some((tok) => normalizedInput.includes(tok))) {
        return cat;
      }
    }
  }

  return null;
}

export class CategorySuggestionService {
  private categoryRepository: CategoryRepository;
  private transactionRepository: TransactionRepository;

  constructor(
    categoryRepository: CategoryRepository = new CategoryRepository(),
    transactionRepository: TransactionRepository = new TransactionRepository()
  ) {
    this.categoryRepository = categoryRepository;
    this.transactionRepository = transactionRepository;
  }

  public async suggestCategory(description: string): Promise<Category | null> {
    const trimmed = description.trim();
    if (trimmed.length < 2) {
      return null;
    }

    const [categories, recentPage] = await Promise.all([
      this.categoryRepository.findAll(),
      this.transactionRepository.findPaginated(1, 200),
    ]);

    return suggestCategoryFromData(trimmed, categories, recentPage.data);
  }
}
