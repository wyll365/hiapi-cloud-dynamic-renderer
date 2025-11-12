import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'

import fg from 'fast-glob'

type Options = {
  dst: string | 'src/DynamicRenderer.vue'
  dirs: string
  property?:boolean
}
const removeKeys = new Set(['src', 'components', 'index.vue'])

function toKebabCase(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[_\s]+/g, '-').toLowerCase()
}


/**
 * 自动生成 DynamicRenderer.vue
 */
export default function dynamicRendererPlugin(options: Options) {
  const {
    dirs = 'src/components/**/*.vue',
    dst = 'src/layouts/DynamicRenderer.vue',
  } = options

  const absOutputFile = path.resolve(process.cwd(), dst)
  const modules = fg.sync(dirs)

  function generateRenderer() {

    const importLines = []
    const renderLines = []
    modules.forEach((path:string) => {
      const parts = path.split('/').filter(p => p && !removeKeys.has(p)).map(e => e.toLowerCase())
      const rawName = parts.join('-').replace('.vue', '')
      const kebab = toKebabCase(rawName)
      const pascal = rawName.split(/[-_]/)
        .map(s => s.charAt(0).toUpperCase() + s.slice(1))
        .join('')

      importLines.push(`import ${pascal} from '${path}'`)
      if (options.property) {
        renderLines.push(`<${kebab} v-if="(props.property?(item.component+'-property'):item.component) === '${kebab}'" :schema="item" />`)
      }else {
        renderLines.push(`<${kebab} v-if="item.component === '${kebab}'" :schema="item" />`)
      }
    })
    const content = `
<template>
<!--兼容小程序  输出所有组建 -->
<!--{{schemas}}-->
  <view v-for="item in schemas">
  ${renderLines.join('\n')}
  </view>
</template>

<script setup lang="ts">
import type {HiapiCloudSchemas,HiapiCloudSchema} from "@hiapi/hiapi-cloud-web-basic"
${options.property?'const props = defineProps<{ layout: HiapiCloudSchemas,property:Boolean }>()':'const props = defineProps<{ layout: HiapiCloudSchemas}>()'}
const schemas:ComputedRef<Array<HiapiCloudSchema>> = computed(()=>props.layout?.schemas??[])
</script>
`
    fs.writeFileSync(absOutputFile, content)
    console.log(`✅ [DynamicRenderer] 已生成 (${modules.length} 个组件)`)
  }

  return {
    name: 'vite-plugin-dynamic-renderer',
    apply: 'serve', // 仅开发模式生效
    buildStart() {
      generateRenderer()
      // 监听组件目录变化
      const watcher = chokidar.watch(dirs, {ignoreInitial: true})
      watcher.on('add', generateRenderer)
      watcher.on('unlink', generateRenderer)
    },
  }
}
