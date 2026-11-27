package com.solina.assistant

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object TaskStore {
    private const val PREFS = "solina_scheduled_tasks"
    private const val KEY = "tasks"

    @Synchronized fun all(context: Context): JSONArray {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]") ?: "[]"
        return try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
    }

    @Synchronized fun upsert(context: Context, task: JSONObject) {
        val old = all(context)
        val next = JSONArray()
        for (i in 0 until old.length()) {
            val item = old.optJSONObject(i) ?: continue
            if (item.optString("id") != task.optString("id")) next.put(item)
        }
        next.put(task)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, next.toString()).apply()
    }

    @Synchronized fun find(context: Context, id: String): JSONObject? {
        val rows = all(context)
        for (i in 0 until rows.length()) {
            val item = rows.optJSONObject(i) ?: continue
            if (item.optString("id") == id) return item
        }
        return null
    }

    @Synchronized fun remove(context: Context, id: String) {
        val old = all(context)
        val next = JSONArray()
        for (i in 0 until old.length()) {
            val item = old.optJSONObject(i) ?: continue
            if (item.optString("id") != id) next.put(item)
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, next.toString()).apply()
    }
}
