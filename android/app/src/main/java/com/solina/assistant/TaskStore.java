package com.solina.assistant;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

public final class TaskStore {
    private static final String PREFS = "solina_scheduled_tasks";
    private static final String KEY = "tasks";
    private TaskStore() { }

    public static synchronized JSONArray all(Context context) {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]");
        try { return new JSONArray(raw == null ? "[]" : raw); }
        catch (Exception ignored) { return new JSONArray(); }
    }

    public static synchronized void upsert(Context context, JSONObject task) {
        JSONArray old = all(context);
        JSONArray next = new JSONArray();
        for (int i = 0; i < old.length(); i++) {
            JSONObject item = old.optJSONObject(i);
            if (item != null && !item.optString("id").equals(task.optString("id"))) next.put(item);
        }
        next.put(task);
        save(context, next);
    }

    public static synchronized JSONObject find(Context context, String id) {
        JSONArray rows = all(context);
        for (int i = 0; i < rows.length(); i++) {
            JSONObject item = rows.optJSONObject(i);
            if (item != null && item.optString("id").equals(id)) return item;
        }
        return null;
    }

    public static synchronized void setNextFollowUp(Context context, String id, long at) {
        JSONObject task = find(context, id);
        if (task == null) return;
        try { task.put("nextFollowUpAt", at); upsert(context, task); }
        catch (Exception ignored) { }
    }

    public static synchronized void remove(Context context, String id) {
        JSONArray old = all(context);
        JSONArray next = new JSONArray();
        for (int i = 0; i < old.length(); i++) {
            JSONObject item = old.optJSONObject(i);
            if (item != null && !item.optString("id").equals(id)) next.put(item);
        }
        save(context, next);
    }

    private static void save(Context context, JSONArray rows) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY, rows.toString()).commit();
    }
}
