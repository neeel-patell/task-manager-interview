import { createApp } from 'vue'
import { MotionPlugin } from '@vueuse/motion'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './style.css'
import App from './App.vue'
import { router } from './router/index'

createApp(App).use(MotionPlugin).use(router).mount('#app')
