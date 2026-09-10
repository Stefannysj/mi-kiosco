import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useBranding } from '../context/BrandingContext';
import Core from '../core.generated';
export default function VariantPicker({ product, onClose, onConfirm }) {
  const { theme } = useBranding();
  const [selection, setSelection] = useState([]);
  useEffect(() => setSelection([]), [product?.id]);
  const groups = Core.variants(product || {});
  const complete = groups.every((group, index) => group.options.includes(selection[index]));
  let price = Number(product?.price || 0);
  if (complete) { try { price = Core.priceFor(product, selection); } catch { /* selection not complete */ } }
  return <Modal visible={Boolean(product)} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}><View style={[styles.sheet, { backgroundColor: theme.surface }]}>
      <Text style={[styles.title, { color: theme.text }]}>{product?.name}</Text>
      <ScrollView>{groups.map((group, index) => <View key={`${group.name}-${index}`} style={styles.group}>
        <Text style={{ color: theme.text, fontWeight: '700' }}>{group.name}{group.extraPrice ? ` (+ S/ ${Number(group.extraPrice).toFixed(2)})` : ''}</Text>
        {group.options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: selection[index] === option }}
          onPress={() => setSelection(current => { const next = [...current]; next[index] = option; return next; })}
          style={[styles.option, { borderColor: selection[index] === option ? theme.primary : theme.border }]}>
          <Text style={{ color: theme.text }}>{selection[index] === option ? '\u25c9 ' : '\u25cb '}{option}</Text>
        </Pressable>)}
      </View>)}</ScrollView>
      <Pressable disabled={!complete} onPress={() => onConfirm(selection)} style={[styles.button, { backgroundColor: theme.primary, opacity: complete ? 1 : .4 }]}>
        <Text style={{ color: theme.white, fontWeight: '700' }}>Agregar - S/ {price.toFixed(2)}</Text>
      </Pressable>
      <Pressable onPress={onClose} style={styles.button}><Text style={{ color: theme.text }}>Cancelar</Text></Pressable>
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', alignItems: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 520, maxHeight: '90%', padding: 18, borderRadius: 16 }, title: { fontSize: 19, fontWeight: '800', marginBottom: 12 },
  group: { marginBottom: 14 }, option: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 7 },
  button: { minHeight: 48, padding: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 10, marginTop: 8 } });
