package com.example.microfinance_app

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

class MainActivity : FlutterActivity() {

    private val channelName = "com.Enigma Invest/audio_recorder"
    private val permissionCode = 1001

    private var mediaRecorder: MediaRecorder? = null
    private var outputPath: String? = null

    // Holds the pending result while the system permission dialog is showing
    private var pendingResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "startRecording" -> startRecording(result)
                    "stopRecording"  -> stopRecording(result)
                    else             -> result.notImplemented()
                }
            }
    }

    // ── Permission-aware start ────────────────────────────────────────────────

    private fun startRecording(result: MethodChannel.Result) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED
        ) {
            doStartRecording(result)
        } else {
            // Store result; resume recording after user grants permission
            pendingResult = result
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.RECORD_AUDIO),
                permissionCode
            )
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == permissionCode) {
            val pending = pendingResult ?: return
            pendingResult = null
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                doStartRecording(pending)
            } else {
                pending.error("PERMISSION_DENIED", "Microphone permission denied", null)
            }
        }
    }

    // ── Actual recording ──────────────────────────────────────────────────────

    private fun doStartRecording(result: MethodChannel.Result) {
        try {
            val file = File(cacheDir, "lenai_voice_${System.currentTimeMillis()}.m4a")
            outputPath = file.absolutePath

            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            mediaRecorder!!.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(44100)
                setAudioEncodingBitRate(128000)
                setOutputFile(outputPath)
                prepare()
                start()
            }
            result.success(outputPath) // Return path to Dart for Whisper upload
        } catch (e: Exception) {
            result.error("START_ERROR", e.message, null)
        }
    }

    private fun stopRecording(result: MethodChannel.Result) {
        try {
            mediaRecorder?.stop()
            mediaRecorder?.release()
            mediaRecorder = null
            result.success(outputPath)
            outputPath = null
        } catch (e: Exception) {
            mediaRecorder = null
            result.error("STOP_ERROR", e.message, null)
        }
    }
}
