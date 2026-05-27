import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useColors } from "@/hooks/useColors";
import { Alarm, useAlarms } from "@/context/AlarmContext";
import AlarmCard from "@/components/AlarmCard";
import AlarmEditSheet from "@/components/AlarmEditSheet";

export default function AlarmsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alarms, addAlarm, updateAlarm, deleteAlarm, toggleAlarm } = useAlarms();
  const [editingAlarm, setEditingAlarm] = useState<Alarm | null>(null);
  const [showNewAlarm, setShowNewAlarm] = useState(false);

  const handleSaveNew = (alarm: Omit<Alarm, "id">) => {
    addAlarm(alarm);
  };

  const handleSaveEdit = (alarm: Omit<Alarm, "id">) => {
    if (editingAlarm) {
      updateAlarm(editingAlarm.id, alarm);
    }
  };

  const handleDelete = () => {
    if (editingAlarm) {
      deleteAlarm(editingAlarm.id);
      setEditingAlarm(null);
    }
  };

  const paddingTop = insets.top + (Platform.OS === "web" ? 67 : 16);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Alarms</Text>
      </View>

      <FlatList
        data={alarms}
        keyExtractor={(a) => a.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 120 + insets.bottom },
        ]}
        scrollEnabled={!!alarms.length}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="alarm-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No Alarms
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Tap the + button to add your first alarm
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AlarmCard
            alarm={item}
            onToggle={() => toggleAlarm(item.id)}
            onPress={() => setEditingAlarm(item)}
          />
        )}
      />

      {/* FAB */}
      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: colors.foreground,
            bottom: 28 + insets.bottom,
          },
        ]}
        onPress={() => setShowNewAlarm(true)}
      >
        <Ionicons name="add" size={28} color={colors.primaryForeground} />
      </Pressable>

      <AlarmEditSheet
        visible={showNewAlarm}
        onClose={() => setShowNewAlarm(false)}
        onSave={handleSaveNew}
      />

      <AlarmEditSheet
        visible={!!editingAlarm}
        onClose={() => setEditingAlarm(null)}
        alarm={editingAlarm}
        onSave={handleSaveEdit}
        onDelete={handleDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 34,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 4,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 220,
  },
  fab: {
    position: "absolute",
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 10,
  },
});
