import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, useThemedStyles } from '../app/theme';
import IconTextInput from './icon-text-input';
import JoblyIcon from './jobly-icon';

type TagInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  label?: string;
  suggestions?: string[];
  popularCount?: number; // how many suggestions to show when input empty
};

const TagInput: React.FC<TagInputProps> = ({ value, onChange, placeholder, label, suggestions = [], popularCount = 6 }) => {
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => createStyles(t));
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

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
    if (!q) return left.slice(0, popularCount);
    return left.filter((s) => s.toLowerCase().includes(q)).slice(0, popularCount);
  }, [cleaned, popularCount, suggestions, text]);

  const addSuggestion = (s: string) => add(s);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputRow}>
        <IconTextInput
          icon="search-outline"
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          containerStyle={styles.input}
          onSubmitEditing={() => add()}
          blurOnSubmit={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
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
      {focused && available.length > 0 && (
        <View style={styles.suggestions}>
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
        </View>
      )}
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
    marginTop: 6,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 12,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
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
