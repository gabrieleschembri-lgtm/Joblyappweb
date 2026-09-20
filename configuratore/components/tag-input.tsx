import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme, useThemedStyles } from '../app/theme';
import IconTextInput from './icon-text-input';
import JoblyIcon from './jobly-icon';

type TagInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  label?: string;
  suggestions?: string[];
};

const TagInput: React.FC<TagInputProps> = ({ value, onChange, placeholder, label, suggestions = [] }) => {
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);

  const cleaned = useMemo(() => new Set(value.map((v) => v.trim()).filter(Boolean)), [value]);

  const add = useCallback((raw?: string) => {
    const base = typeof raw === 'string' ? raw : text;
    const parts = base
      .split(/\n|,/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length === 0) return;
    const next = new Set(cleaned);
    parts.forEach((p) => next.add(p));
    onChange(Array.from(next));
    setText('');
  }, [cleaned, onChange, text]);

  const remove = useCallback((tag: string) => {
    const next = value.filter((t) => t !== tag);
    onChange(next);
  }, [onChange, value]);

  const available = useMemo(() => {
    const left = (suggestions || []).filter((s) => !cleaned.has(s));
    const q = text.trim().toLowerCase();
    if (!q) return left;
    return left.filter((s) => s.toLowerCase().includes(q));
  }, [cleaned, suggestions, text]);

  const addSuggestion = (s: string) => add(s);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {label && <Text style={styles.label}>{label}</Text>}
        {suggestions.length > 0 ? (
          <Pressable
            style={styles.optionsButton}
            onPress={() => setExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={`${expanded ? 'Nascondi' : 'Mostra'} opzioni per ${label ?? 'il campo'}`}
            accessibilityState={{ expanded }}
          >
            <Text style={styles.optionsButtonText}>
              {expanded ? 'Nascondi opzioni' : `Mostra opzioni (${available.length})`}
            </Text>
            <JoblyIcon
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size="small"
              color={theme.colors.primary}
            />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.inputRow}>
        <IconTextInput
          icon="search-outline"
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          containerStyle={styles.input}
          onSubmitEditing={() => add()}
          blurOnSubmit={false}
          onFocus={() => setExpanded(true)}
          multiline
        />
        <Pressable
          style={styles.addButton}
          onPress={() => add()}
          accessibilityRole="button"
          accessibilityLabel="Aggiungi voce"
        >
          <JoblyIcon name="add" size="standard" color={theme.colors.surface} />
        </Pressable>
      </View>
      {expanded && available.length > 0 && (
        <ScrollView
          style={styles.suggestions}
          contentContainerStyle={styles.suggestionsContent}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {available.map((s) => (
            <Pressable
              key={s}
              style={styles.suggestionItem}
              onPress={() => addSuggestion(s)}
              accessibilityRole="button"
              accessibilityLabel={`Aggiungi ${s}`}
            >
              <JoblyIcon name="add-circle-outline" size="small" color={theme.colors.primary} />
              <Text style={styles.suggestionText}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {expanded && suggestions.length > 0 && available.length === 0 ? (
        <Text style={styles.emptySuggestions}>Tutte le opzioni disponibili sono state selezionate.</Text>
      ) : null}
      {value.length > 0 && (
        <View style={styles.tags}>
          {value.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
              <Pressable
                onPress={() => remove(tag)}
                style={styles.remove}
                accessibilityRole="button"
                accessibilityLabel={`Rimuovi ${tag}`}
              >
                <JoblyIcon name="close" size={14} color={theme.colors.primary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const createStyles = (t: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: t.colors.textPrimary,
  },
  labelRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionsButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  optionsButtonText: {
    color: t.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  input: {
    flex: 1,
    minHeight: 44,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.primary,
  },
  suggestions: {
    maxHeight: 224,
    marginTop: 6,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 12,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
  },
  suggestionsContent: {
    flexGrow: 0,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.border,
  },
  suggestionText: {
    fontSize: 14,
    color: t.colors.textPrimary,
    flex: 1,
  },
  emptySuggestions: {
    color: t.colors.muted,
    fontSize: 13,
    paddingVertical: 8,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: t.colors.card,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 16,
  },
  tagText: {
    color: t.colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  remove: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surface,
  },
});

export default TagInput;
