import Alpine from 'alpinejs'
import '@tabler/icons-webfont/dist/tabler-icons.min.css'
import './style.css'
import defrag from './defrag.js'

Alpine.data('defrag', defrag)
window.Alpine = Alpine
Alpine.start()
