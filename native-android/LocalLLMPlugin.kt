package com.af4.ai

import android.content.Context
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.SamplerConfig
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.Executors

@CapacitorPlugin(name = "LocalLLM")
class LocalLLMPlugin : Plugin() {
    private val worker = Executors.newSingleThreadExecutor()
    @Volatile private var engine: Engine? = null
    @Volatile private var preparing = false

    private val modelName = "Qwen3-1.7B_dynamic_wi4b32_afp32.litertlm"
    private val expectedSha256 = "2eeffef7b51bc3e1225ea69fe7aa5f417397934b56a5b6c20cc068d6fd2c918b"
    private val systemInstruction = """
        تو AF4 AI هستی، یک دستیار فارسی‌زبان صمیمی، دقیق و خلاق.
        به فارسی طبیعی و محاوره‌ای پاسخ بده و لحن را با کاربر هماهنگ کن.
        غلط‌های تایپی و گفتار محاوره‌ای را از روی بافت جمله بفهم؛ اگر منظور روشن است، دربارهٔ غلط املایی سؤال نکن.
        پاسخ را مستقیم، مفید و متناسب با درخواست بده؛ برای سؤال ساده کوتاه و برای درخواست پیچیده ساختاریافته و کامل پاسخ بده.
        اگر چیزی را نمی‌دانی، صادقانه بگو. اطلاعات زنده یا جست‌وجوی اینترنتی را جعل نکن.
        زنجیرهٔ استدلال خصوصی را نمایش نده؛ فقط نتیجه و توضیح لازم را ارائه کن.
    """.trimIndent()

    private fun modelFile(): File = File(context.filesDir, modelName)

    @PluginMethod
    fun status(call: PluginCall) {
        val file = modelFile()
        val result = JSObject()
        result.put("available", file.isFile && file.length() > 900_000_000L)
        result.put("ready", engine != null)
        result.put("modelBytes", if (file.isFile) file.length() else 0L)
        call.resolve(result)
    }

    @PluginMethod
    fun prepare(call: PluginCall) {
        worker.execute {
            try {
                ensureEngine()
                val result = JSObject()
                result.put("ready", true)
                result.put("model", "Qwen3-1.7B Local")
                call.resolve(result)
            } catch (error: Exception) {
                call.reject("آماده‌سازی مغز آفلاین ناموفق بود: " + (error.message ?: "خطای نامشخص"), error)
            }
        }
    }

    @PluginMethod
    fun generate(call: PluginCall) {
        val prompt = call.getString("text")?.trim().orEmpty()
        if (prompt.isBlank()) {
            call.reject("متن پیام خالی است.")
            return
        }
        worker.execute {
            var conversation: Conversation? = null
            try {
                ensureEngine()
                val activeEngine = engine ?: throw IllegalStateException("مدل آفلاین آماده نشد.")
                conversation = activeEngine.createConversation(
                    ConversationConfig(
                        systemInstruction = Contents.of(systemInstruction),
                        samplerConfig = SamplerConfig(topK = 20, topP = 0.9, temperature = 0.7)
                    )
                )
                val answer = conversation.sendMessage(prompt).trim()
                if (answer.isBlank()) throw IllegalStateException("مدل پاسخ متنی نساخت.")
                val result = JSObject()
                result.put("text", answer)
                result.put("model", "Qwen3-1.7B Local")
                call.resolve(result)
            } catch (error: Exception) {
                call.reject("پاسخ آفلاین آماده نشد: " + (error.message ?: "خطای نامشخص"), error)
            } finally {
                try { conversation?.close() } catch (_: Exception) {}
            }
        }
    }

    private fun ensureEngine() {
        if (engine != null) return
        val target = modelFile()
        if (!target.isFile || target.length() < 900_000_000L) {
            if (preparing) throw IllegalStateException("آماده‌سازی مدل در حال انجام است؛ کمی صبر کن.")
            preparing = true
            try {
                val temp = File(context.filesDir, "$modelName.partial")
                val total = context.assets.openFd("llm/$modelName").use { it.length }
                var copied = 0L
                context.assets.open("llm/$modelName").use { input ->
                    temp.outputStream().buffered().use { output ->
                        val buffer = ByteArray(1024 * 1024)
                        while (true) {
                            val count = input.read(buffer)
                            if (count < 0) break
                            output.write(buffer, 0, count)
                            copied += count
                            val progress = JSObject()
                            progress.put("copiedBytes", copied)
                            progress.put("totalBytes", total)
                            progress.put("percent", if (total > 0) (copied * 100 / total).toInt() else 0)
                            notifyListeners("modelProgress", progress)
                        }
                    }
                }
                if (temp.length() < 900_000_000L) throw IllegalStateException("فایل مدل ناقص است.")
                val digest = sha256(temp)
                if (!digest.equals(expectedSha256, ignoreCase = true)) {
                    temp.delete()
                    throw IllegalStateException("بررسی سلامت فایل مدل ناموفق بود.")
                }
                if (target.exists()) target.delete()
                if (!temp.renameTo(target)) throw IllegalStateException("ذخیرهٔ مدل در حافظهٔ دستگاه ناموفق بود.")
            } finally {
                preparing = false
            }
        }
        val config = EngineConfig(
            modelPath = target.absolutePath,
            backend = Backend.CPU(),
            cacheDir = context.cacheDir.absolutePath
        )
        val initialized = Engine(config)
        initialized.initialize()
        engine = initialized
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().buffered().use { input ->
            val buffer = ByteArray(1024 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    override fun handleOnDestroy() {
        worker.execute {
            try { engine?.close() } catch (_: Exception) {}
            engine = null
            worker.shutdown()
        }
        super.handleOnDestroy()
    }
}
