package com.example.auramusic

import android.app.Application
import com.example.auramusic.data.local.AppDatabase
import com.example.auramusic.data.repository.MusicRepository
import com.example.auramusic.player.AuraPlayerController

class AuraApplication : Application() {

    lateinit var database: AppDatabase
        private set

    lateinit var repository: MusicRepository
        private set

    lateinit var playerController: AuraPlayerController
        private set

    override fun onCreate() {
        super.onCreate()
        database = AppDatabase.getDatabase(this)
        repository = MusicRepository(database.musicDao())
        playerController = AuraPlayerController(this)
    }
}
