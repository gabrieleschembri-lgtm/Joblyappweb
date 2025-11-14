import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type TagInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  label?: string;
  suggestions?: string[];
  popularCount?: number; // how many suggestions to show when input empty
};

const TagInput: React.FC<TagInputProps> = ({ value, onChange, placeholder, label, suggestions = [], popularCount = 6 }) => {
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
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          style={styles.input}
          onSubmitEditing={() => add()}
          blurOnSubmit={false}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline
        />
        <Pressable style={styles.addButton} onPress={() => add()} accessibilityRole="button">
          <Ionicons name="add" size={18} color="#ffffff" />
        </Pressable>
      </View>
      {focused && available.length > 0 && (
        <View style={styles.suggestions}>
          {available.map((s) => (
            <Pressable key={s} style={styles.suggestionItem} onPress={() => addSuggestion(s)} accessibilityRole="button">
              <Ionicons name="add-circle-outline" size={16} color="#2563eb" />
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
              <Pressable onPress={() => remove(tag)} style={styles.remove} accessibilityRole="button">
                <Ionicons name="close" size={14} color="#2563eb" />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'stretch',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    minHeight: 44,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
  },
  suggestions: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#1e293b',
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
    backgroundColor: '#e0e7ff',
    borderRadius: 16,
  },
  tagText: {
    color: '#1d4ed8',
    fontWeight: '600',
    fontSize: 13,
  },
  remove: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});

export default TagInput;
