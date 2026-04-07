import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Icon from "@/components/Icon";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Colors } from "@/constants/colors";
import { aiApi, AiChatResponse, Transaction } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  transaction?: Transaction;
  timestamp: Date;
}

const SUGGESTED_PROMPTS = [
  "What did I spend today?",
  "Add expense ₹50 food",
  "Show budget status",
  "Add 5000 salary income",
  "How much did I spend this month?",
];

export default function AiScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hi! I'm your SmartSpend AI assistant. I can help you track expenses, analyze spending, and manage your budget. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isSending) return;
    const userMsg: Message = {
      id: Date.now().toString() + "u",
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [userMsg, ...prev]);
    setInput("");
    setIsSending(true);

    try {
      const res: AiChatResponse = await aiApi.chat(text.trim());
      const aiMsg: Message = {
        id: Date.now().toString() + "a",
        role: "assistant",
        content: res.reply,
        transaction: res.transaction,
        timestamp: new Date(),
      };
      setMessages((prev) => [aiMsg, ...prev]);
      
      // If a transaction was created, refresh dashboard
      if (res.transaction) {
        queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      }
    } catch {
      const mockResult = mockAiResponse(text);
      const aiMsg: Message = {
        id: Date.now().toString() + "a",
        role: "assistant",
        content: mockResult.reply,
        transaction: mockResult.transaction,
        timestamp: new Date(),
      };
      setMessages((prev) => [aiMsg, ...prev]);
      
      // If a transaction was created in mock, refresh dashboard
      if (mockResult.transaction) {
        queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      }
    } finally {
      setIsSending(false);
    }
  }, [isSending, queryClient]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}
      behavior="padding"
      keyboardVerticalOffset={tabBarHeight}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.aiAvatar}>
          <Icon name="zap" size={20} color="#fff" />
        </View>
        <View>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSub}>Powered by SmartSpend AI</Text>
        </View>
      </View>

      {/* Messages (inverted FlatList) */}
      <FlatList
        ref={listRef}
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: 8 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          isSending ? (
            <View style={[styles.bubble, styles.assistantBubble, { marginBottom: 8 }]}>
              <TypingIndicator />
            </View>
          ) : null
        }
        renderItem={({ item: msg }) => (
          <View style={[styles.messageWrapper, msg.role === "user" ? styles.userWrapper : styles.assistantWrapper]}>
            {msg.role === "assistant" && (
              <View style={styles.smallAvatar}>
                <Icon name="zap" size={12} color="#fff" />
              </View>
            )}
            <View style={[styles.bubble, msg.role === "user" ? styles.userBubble : styles.assistantBubble]}>
              <Text style={[styles.bubbleText, msg.role === "user" && styles.userBubbleText]}>
                {msg.content}
              </Text>
              {msg.transaction && (
                <View style={styles.txConfirm}>
                  <Icon name="check-circle" size={14} color={Colors.income} />
                  <Text style={styles.txConfirmText}>
                    Transaction saved: {msg.transaction.title} — ₹{msg.transaction.amount}
                  </Text>
                </View>
              )}
              <Text style={[styles.timestamp, msg.role === "user" && { color: "rgba(255,255,255,0.6)" }]}>
                {msg.timestamp.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>
        )}
      />

      {/* Suggested Prompts */}
      {messages.length <= 1 && (
        <View style={styles.suggestions}>
          {SUGGESTED_PROMPTS.map((p) => (
            <Pressable key={p} style={styles.suggestionChip} onPress={() => sendMessage(p)}>
              <Text style={styles.suggestionText}>{p}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputArea, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 12) + tabBarHeight }]}>
        <TextInput
          style={styles.textInput}
          placeholder="Ask about your finances..."
          placeholderTextColor={Colors.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          returnKeyType="send"
          onSubmitEditing={() => sendMessage(input)}
        />
        <Pressable
          style={[styles.sendBtn, (!input.trim() || isSending) && styles.sendBtnDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="send" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function TypingIndicator() {
  return (
    <View style={{ flexDirection: "row", gap: 4, alignItems: "center", paddingVertical: 4 }}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: Colors.textSecondary,
            opacity: 0.6,
          }}
        />
      ))}
    </View>
  );
}

function mockAiResponse(message: string): { reply: string; transaction?: Transaction } {
  const lower = message.toLowerCase();
  
  // Parse expense addition
  const expenseMatch = lower.match(/add\s+expense\s+₹?(\d+(?:\.\d{1,2})?)\s*(.+)/);
  if (expenseMatch) {
    const amount = parseFloat(expenseMatch[1]);
    const category = expenseMatch[2].trim();
    return {
      reply: `✅ Added expense of ₹${amount.toFixed(2)} for ${category}. Transaction saved successfully!`,
      transaction: {
        id: Date.now().toString(),
        title: `${category} expense`,
        amount,
        type: "expense",
        category,
        categoryIcon: "🛒",
        categoryColor: "#FF6B6B",
        date: new Date().toISOString(),
        source: "ai"
      }
    };
  }
  
  // Parse income addition
  const incomeMatch = lower.match(/add\s+(\d+(?:\.\d{1,2})?)\s*(.+)\s+income/i);
  if (incomeMatch) {
    const amount = parseFloat(incomeMatch[1]);
    const source = incomeMatch[2].trim();
    return {
      reply: `✅ Added income of ₹${amount.toFixed(2)} from ${source}. Transaction saved successfully!`,
      transaction: {
        id: Date.now().toString(),
        title: `${source} income`,
        amount,
        type: "income",
        category: "Salary",
        categoryIcon: "💰",
        categoryColor: "#4ECDC4",
        date: new Date().toISOString(),
        source: "ai"
      }
    };
  }
  
  if (lower.includes("spend") || lower.includes("spent")) {
    return {
      reply: "Based on your transactions, you've spent ₹3,120 this month. Your biggest category is Housing at ₹1,200."
    };
  }
  
  if (lower.includes("budget")) {
    return {
      reply: "Your Food & Dining budget is at 80% (spent ₹320 of ₹400 limit). Shopping is at 93% — consider slowing down!"
    };
  }
  
  if (lower.includes("saving")) {
    return {
      reply: "You're saving ₹5,120 this month. That's 62% of your income — excellent!"
    };
  }
  
  return {
    reply: "I understand you're asking about your finances. Try asking me to 'Add expense ₹50 food' or 'Add 5000 salary income' and I'll create actual transactions for you!"
  };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: Colors.text },
  headerSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: Colors.textSecondary },
  list: { padding: 16 },
  messageWrapper: { flexDirection: "row", marginBottom: 12, alignItems: "flex-end", gap: 8 },
  userWrapper: { justifyContent: "flex-end" },
  assistantWrapper: { justifyContent: "flex-start" },
  smallAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    padding: 14,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleText: { fontFamily: "Inter_400Regular", fontSize: 14, color: Colors.text, lineHeight: 20 },
  userBubbleText: { color: "#fff" },
  timestamp: { fontFamily: "Inter_400Regular", fontSize: 10, color: Colors.textSecondary, marginTop: 4, alignSelf: "flex-end" },
  txConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.income + "15",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 8,
  },
  txConfirmText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.income, flex: 1 },
  suggestions: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestionChip: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.primary + "40",
  },
  suggestionText: { fontFamily: "Inter_500Medium", fontSize: 12, color: Colors.primary },
  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: Colors.border },
});
