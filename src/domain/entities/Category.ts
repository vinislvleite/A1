export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  is_custom: boolean;
}

export interface CreateCategoryDTO {
  name: string;
  description?: string;
  color: string;
  icon: string;
  is_custom: boolean;
}

export interface UpdateCategoryDTO {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  is_custom?: boolean;
}
