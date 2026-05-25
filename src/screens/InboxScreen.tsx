import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";

import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../lib/firebase";

type TimelineItem = {
  id: string;
  type: "task" | "event" | "idea";
  title: string;
  description?: string;
  status?: string;
  due_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  created_at?: any;
};

type GroupedItems = {
  title: string;
  items: TimelineItem[];
};

export default function InboxScreen() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<TimelineItem | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      return;
    }

    let tasks: TimelineItem[] = [];
    let events: TimelineItem[] = [];
    let ideas: TimelineItem[] = [];

    function updateAllItems() {
      const combined = [...tasks, ...events, ...ideas];

      const sorted = combined.sort((a, b) => {
        const aTime = a.created_at?.seconds || 0;
        const bTime = b.created_at?.seconds || 0;
        return bTime - aTime;
      });

      setItems(sorted);
      setLoading(false);
    }

    const tasksQuery = query(
      collection(db, "tasks"),
      where("user_id", "==", user.uid)
    );

    const eventsQuery = query(
      collection(db, "events"),
      where("user_id", "==", user.uid)
    );

    const ideasQuery = query(
      collection(db, "ideas"),
      where("user_id", "==", user.uid)
    );

    const unsubscribeTasks = onSnapshot(tasksQuery, (snapshot) => {
      tasks = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          type: "task",
          title: data.title || "Tarefa sem título",
          description: data.description || "",
          status: data.status || "open",
          due_date: data.due_date || null,
          created_at: data.created_at,
        };
      });

      updateAllItems();
    });

    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      events = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          type: "event",
          title: data.title || "Evento sem título",
          description: "",
          start_time: data.start_time || null,
          end_time: data.end_time || null,
          created_at: data.created_at,
        };
      });

      updateAllItems();
    });

    const unsubscribeIdeas = onSnapshot(ideasQuery, (snapshot) => {
      ideas = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();

        return {
          id: docSnap.id,
          type: "idea",
          title: data.title || "Ideia sem título",
          description: data.content || "",
          created_at: data.created_at,
        };
      });

      updateAllItems();
    });

    return () => {
      unsubscribeTasks();
      unsubscribeEvents();
      unsubscribeIdeas();
    };
  }, []);

  function getTypeLabel(type: TimelineItem["type"]) {
    if (type === "task") return "Tarefa";
    if (type === "event") return "Evento";
    return "Ideia";
  }

  function getTypeSymbol(type: TimelineItem["type"]) {
    if (type === "task") return "✓";
    if (type === "event") return "◷";
    return "✦";
  }

  function getCollectionName(type: TimelineItem["type"]) {
    if (type === "task") return "tasks";
    if (type === "event") return "events";
    return "ideas";
  }

  function getCreatedDate(item: TimelineItem) {
    if (!item.created_at?.seconds) return null;
    return new Date(item.created_at.seconds * 1000);
  }

  function formatDate(item: TimelineItem) {
    const date = getCreatedDate(item);

    if (!date) return "Sem data";

    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  function isSameDay(a: Date, b: Date) {
    return (
      a.getDate() === b.getDate() &&
      a.getMonth() === b.getMonth() &&
      a.getFullYear() === b.getFullYear()
    );
  }

  function groupItemsByDate(sourceItems: TimelineItem[]): GroupedItems[] {
    const today = new Date();

    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const todayItems: TimelineItem[] = [];
    const yesterdayItems: TimelineItem[] = [];
    const previousItems: TimelineItem[] = [];
    const undatedItems: TimelineItem[] = [];

    sourceItems.forEach((item) => {
      const date = getCreatedDate(item);

      if (!date) {
        undatedItems.push(item);
        return;
      }

      if (isSameDay(date, today)) {
        todayItems.push(item);
      } else if (isSameDay(date, yesterday)) {
        yesterdayItems.push(item);
      } else {
        previousItems.push(item);
      }
    });

    const groups: GroupedItems[] = [];

    if (todayItems.length > 0) {
      groups.push({
        title: "Hoje",
        items: todayItems,
      });
    }

    if (yesterdayItems.length > 0) {
      groups.push({
        title: "Ontem",
        items: yesterdayItems,
      });
    }

    if (previousItems.length > 0) {
      groups.push({
        title: "Anteriores",
        items: previousItems,
      });
    }

    if (undatedItems.length > 0) {
      groups.push({
        title: "Sem data",
        items: undatedItems,
      });
    }

    return groups;
  }

  async function markTaskAsDone(item: TimelineItem) {
    try {
      if (item.type !== "task") return;

      setUpdating(true);

      await updateDoc(doc(db, "tasks", item.id), {
        status: "done",
        completed_at: serverTimestamp(),
      });

      setSelectedItem({
        ...item,
        status: "done",
      });
    } catch (error) {
      console.error(error);

      Alert.alert("Erro", "Não foi possível concluir a tarefa.");
    } finally {
      setUpdating(false);
    }
  }

  const groupedItems = groupItemsByDate(items);

  if (selectedItem) {
    return (
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setSelectedItem(null)}
        >
          <Text style={styles.backButtonText}>← Voltar</Text>
        </TouchableOpacity>

        <View style={styles.detailCard}>
          <View style={styles.cardHeader}>
            <View style={styles.symbolCircle}>
              <Text style={styles.symbolText}>
                {getTypeSymbol(selectedItem.type)}
              </Text>
            </View>

            <Text style={styles.typeLabel}>
              {getTypeLabel(selectedItem.type)}
            </Text>
          </View>

          <Text style={styles.detailTitle}>{selectedItem.title}</Text>

          {selectedItem.description ? (
            <Text style={styles.detailDescription}>
              {selectedItem.description}
            </Text>
          ) : null}

          {selectedItem.due_date ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Prazo</Text>
              <Text style={styles.infoText}>{selectedItem.due_date}</Text>
            </View>
          ) : null}

          {selectedItem.start_time ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Início</Text>
              <Text style={styles.infoText}>{selectedItem.start_time}</Text>
            </View>
          ) : null}

          {selectedItem.end_time ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Fim</Text>
              <Text style={styles.infoText}>{selectedItem.end_time}</Text>
            </View>
          ) : null}

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Criado em</Text>
            <Text style={styles.infoText}>{formatDate(selectedItem)}</Text>
          </View>

          {selectedItem.type === "task" ? (
            selectedItem.status === "done" ? (
              <View style={styles.doneBox}>
                <Text style={styles.doneText}>Tarefa concluída</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.primaryButton}
                disabled={updating}
                onPress={() => markTaskAsDone(selectedItem)}
              >
                <Text style={styles.primaryButtonText}>
                  {updating ? "Atualizando..." : "Marcar como concluída"}
                </Text>
              </TouchableOpacity>
            )
          ) : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Inbox</Text>

      <Text style={styles.subtitle}>
        Uma linha do tempo calma do que você capturou.
      </Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Nada salvo ainda</Text>

          <Text style={styles.emptyText}>
            Grave uma captura, revise o resultado e confirme. O Eido vai
            organizar tarefas, eventos e ideias aqui.
          </Text>
        </View>
      ) : (
        groupedItems.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={styles.groupTitle}>{group.title}</Text>

            {group.items.map((item) => (
              <TouchableOpacity
                key={`${item.type}-${item.id}`}
                style={[
                  styles.card,
                  item.type === "task" &&
                    item.status === "done" &&
                    styles.completedCard,
                ]}
                activeOpacity={0.75}
                onPress={() => setSelectedItem(item)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.symbolCircle}>
                    <Text style={styles.symbolText}>
                      {getTypeSymbol(item.type)}
                    </Text>
                  </View>

                  <Text style={styles.typeLabel}>
                    {getTypeLabel(item.type)}
                  </Text>

                  {item.type === "task" && item.status === "done" ? (
                    <Text style={styles.doneInline}>Concluída</Text>
                  ) : null}
                </View>

                <Text
                  style={[
                    styles.itemTitle,
                    item.type === "task" &&
                      item.status === "done" &&
                      styles.completedText,
                  ]}
                >
                  {item.title}
                </Text>

                {item.description ? (
                  <Text style={styles.itemDescription}>
                    {item.description}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F5F4EF",
    paddingHorizontal: 24,
    paddingTop: 72,
    paddingBottom: 120,
  },

  title: {
    fontSize: 44,
    fontWeight: "700",
    color: "#111827",
  },

  subtitle: {
    fontSize: 18,
    color: "#6B7280",
    marginTop: 10,
    marginBottom: 34,
    lineHeight: 26,
  },

  loadingContainer: {
    marginTop: 48,
    alignItems: "center",
  },

  loadingText: {
    marginTop: 12,
    color: "#6B7280",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
  },

  emptyTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },

  emptyText: {
    fontSize: 16,
    lineHeight: 24,
    color: "#6B7280",
  },

  group: {
    marginBottom: 28,
  },

  groupTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 20,
    marginBottom: 14,
  },

  completedCard: {
    opacity: 0.62,
  },

  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  symbolCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  symbolText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#374151",
  },

  typeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  doneInline: {
    marginLeft: "auto",
    fontSize: 12,
    fontWeight: "700",
    color: "#166534",
  },

  itemTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
    lineHeight: 26,
  },

  completedText: {
    textDecorationLine: "line-through",
    color: "#6B7280",
  },

  itemDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: "#4B5563",
  },

  backButton: {
    marginBottom: 24,
  },

  backButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#374151",
  },

  detailCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 24,
  },

  detailTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 38,
    marginBottom: 16,
  },

  detailDescription: {
    fontSize: 17,
    lineHeight: 27,
    color: "#374151",
    marginBottom: 22,
  },

  infoBox: {
    backgroundColor: "#F3F4F6",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },

  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },

  infoText: {
    fontSize: 16,
    color: "#111827",
    lineHeight: 23,
  },

  primaryButton: {
    backgroundColor: "#111827",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: "center",
    marginTop: 20,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },

  doneBox: {
    backgroundColor: "#DCFCE7",
    borderRadius: 18,
    padding: 16,
    marginTop: 20,
    alignItems: "center",
  },

  doneText: {
    color: "#166534",
    fontSize: 16,
    fontWeight: "700",
  },
});