export interface Goal {
  id: string;
  name: string;
  target_value: number;
  deadline: string;
  current_value: number;
}

export interface CreateGoalDTO {
  name: string;
  target_value: number;
  deadline: string;
  current_value?: number;
}

export interface UpdateGoalDTO {
  name?: string;
  target_value?: number;
  deadline?: string;
  current_value?: number;
}
