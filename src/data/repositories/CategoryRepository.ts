import { DatabaseManager } from '../database/SQLiteDatabase';
import { Category, CreateCategoryDTO, UpdateCategoryDTO } from '../../domain/entities/Category';
import { generateUUID } from '../../utils/uuid';

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_custom: number;
}

export class CategoryRepository {
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager = DatabaseManager.getInstance()) {
    this.dbManager = dbManager;
  }

  public async create(data: CreateCategoryDTO): Promise<Category> {
    const id = generateUUID();
    const isCustomInt = data.is_custom ? 1 : 0;

    try {
      await this.dbManager.executeQuery(
        `INSERT INTO categories (id, name, description, color, icon, is_custom)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [id, data.name, data.description ?? null, data.color, data.icon, isCustomInt]
      );

      const created = await this.findById(id);
      if (!created) {
        throw new Error(`Falha ao recuperar categoria recém-criada com ID: ${id}`);
      }
      return created;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao criar categoria: ${message}`);
    }
  }

  public async findById(id: string): Promise<Category | null> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, description, color, icon, is_custom FROM categories WHERE id = ?;',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows.item(0) as CategoryRow;
      return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        color: row.color,
        icon: row.icon,
        is_custom: row.is_custom === 1,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao buscar categoria por ID [${id}]: ${message}`);
    }
  }

  public async findAll(): Promise<Category[]> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT id, name, description, color, icon, is_custom FROM categories ORDER BY name ASC;'
      );

      const categories: Category[] = [];
      for (let i = 0; i < result.rows.length; i++) {
        const row = result.rows.item(i) as CategoryRow;
        categories.push({
          id: row.id,
          name: row.name,
          description: row.description ?? undefined,
          color: row.color,
          icon: row.icon,
          is_custom: row.is_custom === 1,
        });
      }

      return categories;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao listar categorias: ${message}`);
    }
  }

  public async update(id: string, data: UpdateCategoryDTO): Promise<Category> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Categoria não encontrada para atualização com ID: ${id}`);
    }

    const name = data.name ?? existing.name;
    const description = data.description !== undefined ? data.description : existing.description;
    const color = data.color ?? existing.color;
    const icon = data.icon ?? existing.icon;
    const isCustomInt = data.is_custom !== undefined ? (data.is_custom ? 1 : 0) : (existing.is_custom ? 1 : 0);

    try {
      await this.dbManager.executeQuery(
        `UPDATE categories
         SET name = ?, description = ?, color = ?, icon = ?, is_custom = ?
         WHERE id = ?;`,
        [name, description ?? null, color, icon, isCustomInt, id]
      );

      const updated = await this.findById(id);
      if (!updated) {
        throw new Error(`Falha ao recuperar categoria atualizada com ID: ${id}`);
      }
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao atualizar categoria [${id}]: ${message}`);
    }
  }

  public async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Categoria não encontrada para exclusão com ID: ${id}`);
    }

    try {
      await this.dbManager.executeQuery('DELETE FROM categories WHERE id = ?;', [id]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao excluir categoria [${id}]: ${message}`);
    }
  }

  public async countTransactionsByCategoryId(categoryId: string): Promise<number> {
    try {
      const result = await this.dbManager.executeQuery(
        'SELECT COUNT(*) as count FROM transactions WHERE category_id = ?;',
        [categoryId]
      );
      if (result.rows.length === 0) return 0;
      return (result.rows.item(0) as { count: number }).count;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Erro ao contar transações da categoria [${categoryId}]: ${message}`);
    }
  }

  public async seedDefaultCategories(): Promise<void> {
    const existing = await this.findAll();
    if (existing.length > 0) {
      return;
    }

    const defaultCategories: CreateCategoryDTO[] = [
      { name: 'Alimentação', description: 'Supermercado, restaurantes, delivery', color: '#F59E0B', icon: 'coffee', is_custom: false },
      { name: 'Transporte', description: 'Combustível, transporte público, aplicativo', color: '#3B82F6', icon: 'navigation', is_custom: false },
      { name: 'Lazer', description: 'Cinema, passeios, viagens, entretenimento', color: '#EC4899', icon: 'smile', is_custom: false },
      { name: 'Saúde', description: 'Farmácia, consultas, plano de saúde', color: '#EF4444', icon: 'activity', is_custom: false },
      { name: 'Educação', description: 'Cursos, livros, faculdade', color: '#8B5CF6', icon: 'book', is_custom: false },
      { name: 'Moradia', description: 'Aluguel, condomínio, luz, água, internet', color: '#10B981', icon: 'home', is_custom: false },
      { name: 'Salário', description: 'Remuneração principal, benefícios', color: '#22C55E', icon: 'dollar-sign', is_custom: false },
      { name: 'Serviços', description: 'Freelas, trabalhos extras, consultoria', color: '#6366F1', icon: 'briefcase', is_custom: false },
      { name: 'Outros', description: 'Despesas e receitas diversas', color: '#6B7280', icon: 'grid', is_custom: false },
    ];

    for (const cat of defaultCategories) {
      await this.create(cat);
    }
  }
}
