import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { dialog } from './DialogManager';
import {
  ConfirmOptions,
  AlertaOptions,
  ConfirmacaoDuplaOptions,
  BottomSheetSelectorOptions,
  DatePickerOptions,
  TimePickerOptions,
  ToastOptions,
  PermissionExplanationOptions,
  DialogQueueItem,
  ActiveToast,
} from './types';
import { AlertDialogView } from './AlertDialogView';
import { DoubleConfirmDialogView } from './DoubleConfirmDialogView';
import { BottomSheetSelectorView } from './BottomSheetSelectorView';
import { DatePickerDialogView } from './DatePickerDialogView';
import { TimePickerDialogView } from './TimePickerDialogView';
import { PermissionExplanationDialogView } from './PermissionExplanationDialogView';
import { ToastView } from './ToastView';

export interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alerta: (options: AlertaOptions) => Promise<void>;
  confirmacaoDupla: (options: ConfirmacaoDuplaOptions) => Promise<boolean>;
  bottomSheet: <T extends string>(
    options: BottomSheetSelectorOptions<T>
  ) => Promise<T | null>;
  datePicker: (options?: DatePickerOptions) => Promise<string | null>;
  timePicker: (options?: TimePickerOptions) => Promise<string | null>;
  toast: (options: ToastOptions) => void;
  solicitarPermissao: (
    options: PermissionExplanationOptions
  ) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeDialog, setActiveDialog] = useState<DialogQueueItem | null>(() =>
    dialog.getActiveDialog()
  );
  const [activeToast, setActiveToast] = useState<ActiveToast | null>(() =>
    dialog.getActiveToast()
  );

  useEffect(() => {
    const unsubscribe = dialog.subscribe(() => {
      setActiveDialog(dialog.getActiveDialog());
      setActiveToast(dialog.getActiveToast());
    });
    return unsubscribe;
  }, []);

  const contextValue: DialogContextValue = {
    confirm: (options) => dialog.confirm(options),
    alerta: (options) => dialog.alerta(options),
    confirmacaoDupla: (options) => dialog.confirmacaoDupla(options),
    bottomSheet: (options) => dialog.bottomSheet(options),
    datePicker: (options) => dialog.datePicker(options),
    timePicker: (options) => dialog.timePicker(options),
    toast: (options) => dialog.toast(options),
    solicitarPermissao: (options) => dialog.solicitarPermissao(options),
  };

  return (
    <DialogContext.Provider value={contextValue}>
      {children}

      <AlertDialogView
        visible={
          activeDialog !== null &&
          (activeDialog.kind === 'confirm' || activeDialog.kind === 'alerta')
        }
        isConfirm={activeDialog?.kind === 'confirm'}
        confirmOptions={
          activeDialog?.kind === 'confirm' ? activeDialog.options : undefined
        }
        alertaOptions={
          activeDialog?.kind === 'alerta' ? activeDialog.options : undefined
        }
        onConfirm={() => {
          if (activeDialog?.kind === 'confirm') {
            activeDialog.resolve(true);
          } else if (activeDialog?.kind === 'alerta') {
            activeDialog.resolve();
          }
        }}
        onCancel={() => {
          if (activeDialog?.kind === 'confirm') {
            activeDialog.resolve(false);
          } else if (activeDialog?.kind === 'alerta') {
            activeDialog.resolve();
          }
        }}
      />

      {activeDialog?.kind === 'confirmacaoDupla' && (
        <DoubleConfirmDialogView
          visible={true}
          options={activeDialog.options}
          onConfirm={() => activeDialog.resolve(true)}
          onCancel={() => activeDialog.resolve(false)}
        />
      )}

      {activeDialog?.kind === 'bottomSheet' && (
        <BottomSheetSelectorView
          visible={true}
          options={activeDialog.options}
          onSelect={(id) => activeDialog.resolve(id)}
        />
      )}

      {activeDialog?.kind === 'datePicker' && (
        <DatePickerDialogView
          visible={true}
          options={activeDialog.options}
          onSelect={(date) => activeDialog.resolve(date)}
        />
      )}

      {activeDialog?.kind === 'timePicker' && (
        <TimePickerDialogView
          visible={true}
          options={activeDialog.options}
          onSelect={(time) => activeDialog.resolve(time)}
        />
      )}

      {activeDialog?.kind === 'permission' && (
        <PermissionExplanationDialogView
          visible={true}
          options={activeDialog.options}
          onFinish={(granted) => activeDialog.resolve(granted)}
        />
      )}

      <ToastView toast={activeToast} />
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextValue => {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    return {
      confirm: (options) => dialog.confirm(options),
      alerta: (options) => dialog.alerta(options),
      confirmacaoDupla: (options) => dialog.confirmacaoDupla(options),
      bottomSheet: (options) => dialog.bottomSheet(options),
      datePicker: (options) => dialog.datePicker(options),
      timePicker: (options) => dialog.timePicker(options),
      toast: (options) => dialog.toast(options),
      solicitarPermissao: (options) => dialog.solicitarPermissao(options),
    };
  }
  return ctx;
};
