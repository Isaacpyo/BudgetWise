import { CATEGORIES, CATEGORY_IDS, type CategoryId } from '@budgetwise/core';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme';
import { categoryIconName, Chip } from './ui';

export function CategoryPicker({
  value,
  onChange,
  categories = CATEGORY_IDS,
}: {
  value: CategoryId | null;
  onChange: (category: CategoryId) => void;
  categories?: readonly CategoryId[];
}) {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {categories.map((id) => (
        <Chip
          key={id}
          label={CATEGORIES[id].label}
          icon={categoryIconName(id)}
          selected={value === id}
          onPress={() => onChange(id)}
          testID={`category-${id}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
