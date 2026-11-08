import { Feather } from '@expo/vector-icons';

export type DialogVariant = 'padrao' | 'perigo' | 'atencao';
export type AlertType = 'informacao' | 'sucesso' | 'erro' | 'atencao';
export type ToastType = 'sucesso' | 'erro' | 'informacao';

export interface ConfirmOptions {
  titulo: string;
  mensagem: string;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  variante?: DialogVariant;
  icone?: keyof typeof Feather.glyphMap;
}

export interface AlertaOptions {
  titulo: string;
  mensagem: string;
  tipo?: AlertType;
  rotuloBotao?: string;
  icone?: keyof typeof Feather.glyphMap;
}

export interface ConfirmacaoDuplaOptions {
  tituloPasso1?: string;
  mensagemPasso1: string;
  rotuloConfirmarPasso1?: string;
  tituloPasso2?: string;
  mensagemPasso2: string;
  rotuloConfirmarPasso2?: string;
  rotuloCancelar?: string;
  detalheDestaque?: string;
}

export interface BottomSheetOption<T = string> {
  id: T;
  label: string;
  sublabel?: string;
  icon?: keyof typeof Feather.glyphMap;
  color?: string;
  badge?: string;
}

export interface BottomSheetSelectorOptions<T = string> {
  titulo: string;
  descricao?: string;
  opcoes: BottomSheetOption<T>[];
  valorSelecionado?: T;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
}

export interface DatePickerOptions {
  titulo?: string;
  dataInicial?: Date | string;
  dataMinima?: Date | string;
  dataMaxima?: Date | string;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
}

export interface TimePickerOptions {
  titulo?: string;
  horaInicial?: string;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
}

export interface ToastOptions {
  mensagem: string;
  tipo?: ToastType;
  duracaoMs?: number;
}

export interface PermissionExplanationOptions {
  titulo: string;
  mensagem: string;
  icone?: keyof typeof Feather.glyphMap;
  motivo?: string;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  aoPermitir: () => Promise<boolean>;
}

export type DialogQueueItem =
  | {
      id: string;
      kind: 'confirm';
      options: ConfirmOptions;
      resolve: (value: boolean) => void;
    }
  | {
      id: string;
      kind: 'alerta';
      options: AlertaOptions;
      resolve: () => void;
    }
  | {
      id: string;
      kind: 'confirmacaoDupla';
      options: ConfirmacaoDuplaOptions;
      resolve: (value: boolean) => void;
    }
  | {
      id: string;
      kind: 'bottomSheet';
      options: BottomSheetSelectorOptions<string>;
      resolve: (value: string | null) => void;
    }
  | {
      id: string;
      kind: 'datePicker';
      options: DatePickerOptions;
      resolve: (value: string | null) => void;
    }
  | {
      id: string;
      kind: 'timePicker';
      options: TimePickerOptions;
      resolve: (value: string | null) => void;
    }
  | {
      id: string;
      kind: 'permission';
      options: PermissionExplanationOptions;
      resolve: (value: boolean) => void;
    };

export interface ActiveToast {
  id: string;
  mensagem: string;
  tipo: ToastType;
  duracaoMs: number;
}
