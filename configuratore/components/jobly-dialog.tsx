import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import JoblyIcon, { type JoblyIconName } from './jobly-icon';
import { useTheme, useThemedStyles, type Theme } from '../app/theme';

export type JoblyDialogAction = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type JoblyDialogRequest = {
  title: string;
  message?: string;
  actions: JoblyDialogAction[];
};

type JoblyDialogContextValue = {
  showDialog: (title: string, message?: string, actions?: JoblyDialogAction[]) => void;
};

const JoblyDialogContext = createContext<JoblyDialogContextValue | null>(null);

const iconForTitle = (title: string): { name: JoblyIconName; tone: 'primary' | 'success' | 'warning' | 'danger' } => {
  const normalizedTitle = title.toLocaleLowerCase('it');
  if (normalizedTitle.includes('errore') || normalizedTitle.includes('non autorizzato')) {
    return { name: 'alert-circle', tone: 'danger' };
  }
  if (normalizedTitle.includes('attenzione') || normalizedTitle.includes('conferma') || normalizedTitle.includes('elimina')) {
    return { name: 'warning', tone: 'warning' };
  }
  if (
    normalizedTitle.includes('successo') ||
    normalizedTitle.includes('salvato') ||
    normalizedTitle.includes('inviata') ||
    normalizedTitle.includes('completat') ||
    normalizedTitle.includes('confermata') ||
    normalizedTitle.includes('rifiutata') ||
    normalizedTitle.includes('eliminato')
  ) {
    return { name: 'checkmark-circle', tone: 'success' };
  }
  return { name: 'information-circle', tone: 'primary' };
};

export const JoblyDialogProvider = ({ children }: { children: ReactNode }) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [activeDialog, setActiveDialog] = useState<JoblyDialogRequest | null>(null);
  const queueRef = useRef<JoblyDialogRequest[]>([]);

  const showNextDialog = useCallback(() => {
    setActiveDialog((currentDialog) => currentDialog ?? queueRef.current.shift() ?? null);
  }, []);

  const showDialog = useCallback(
    (title: string, message?: string, actions: JoblyDialogAction[] = [{ text: 'OK' }]) => {
      const request = {
        title,
        message,
        actions: actions.length > 0 ? actions : [{ text: 'OK' }],
      };
      setActiveDialog((currentDialog) => {
        if (currentDialog) {
          queueRef.current.push(request);
          return currentDialog;
        }
        return request;
      });
    },
    []
  );

  const closeDialog = useCallback(
    (action?: JoblyDialogAction) => {
      setActiveDialog(null);
      action?.onPress?.();
      requestAnimationFrame(showNextDialog);
    },
    [showNextDialog]
  );

  const handleRequestClose = useCallback(() => {
    if (!activeDialog) return;
    const cancelAction = activeDialog.actions.find((action) => action.style === 'cancel');
    if (cancelAction) {
      closeDialog(cancelAction);
    }
  }, [activeDialog, closeDialog]);

  const value = useMemo(() => ({ showDialog }), [showDialog]);
  const dialogIcon = activeDialog ? iconForTitle(activeDialog.title) : null;
  const iconColor = dialogIcon ? theme.colors[dialogIcon.tone] : theme.colors.primary;

  return (
    <JoblyDialogContext.Provider value={value}>
      {children}
      <Modal
        animationType="fade"
        transparent
        visible={activeDialog !== null}
        statusBarTranslucent
        onRequestClose={handleRequestClose}
      >
        <View style={styles.overlay} accessibilityViewIsModal>
          <View style={styles.dialog} accessibilityRole="alert">
            {activeDialog && dialogIcon ? (
              <>
                <View style={[styles.iconContainer, { backgroundColor: `${iconColor}18` }]}>
                  <JoblyIcon name={dialogIcon.name} size="large" color={iconColor} />
                </View>
                <Text style={styles.title}>{activeDialog.title}</Text>
                {activeDialog.message ? <Text style={styles.message}>{activeDialog.message}</Text> : null}
                <View style={styles.actions}>
                  {activeDialog.actions.map((action, index) => {
                    const destructive = action.style === 'destructive';
                    const cancel = action.style === 'cancel';
                    return (
                      <Pressable
                        key={`${action.text}-${index}`}
                        accessibilityRole="button"
                        accessibilityLabel={action.text}
                        onPress={() => closeDialog(action)}
                        style={({ pressed, hovered }) => [
                          styles.action,
                          cancel && styles.cancelAction,
                          destructive && styles.destructiveAction,
                          (pressed || hovered) && styles.actionPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.actionText,
                            cancel && styles.cancelActionText,
                            destructive && styles.destructiveActionText,
                          ]}
                        >
                          {action.text}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </JoblyDialogContext.Provider>
  );
};

export const useJoblyDialog = () => {
  const context = useContext(JoblyDialogContext);
  if (!context) {
    throw new Error('useJoblyDialog must be used within JoblyDialogProvider');
  }
  return context;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      backgroundColor: theme.colors.overlay,
    },
    dialog: {
      width: '100%',
      maxWidth: 440,
      padding: 24,
      borderRadius: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.2,
      shadowRadius: 24,
      elevation: 12,
    },
    iconContainer: {
      width: 56,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      borderRadius: 28,
      marginBottom: 16,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: '700',
      textAlign: 'center',
    },
    message: {
      marginTop: 10,
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
      marginTop: 24,
    },
    action: {
      minWidth: 96,
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
      borderRadius: 14,
      backgroundColor: theme.colors.primary,
    },
    cancelAction: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    destructiveAction: {
      backgroundColor: theme.colors.danger,
    },
    actionPressed: {
      opacity: 0.82,
    },
    actionText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
    cancelActionText: {
      color: theme.colors.textPrimary,
    },
    destructiveActionText: {
      color: '#ffffff',
    },
  });
