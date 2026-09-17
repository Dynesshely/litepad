<script setup lang="ts">
/**
 * 页内 LOGO：直接内联站点图标 public/favicon.svg 的源码，
 * 保证工具栏品牌图形与浏览器标签页图标永远是同一份设计（单一来源，不会漂移）。
 * 内联时去掉 <title>/<desc> 并标记为装饰性（aria-hidden），避免与品牌文字重复朗读。
 */
import faviconSvg from '../assets/favicon.svg?raw'

withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'sm' })

const logo = faviconSvg
  .replace(/<title>[\s\S]*?<\/title>/, '')
  .replace(/<desc>[\s\S]*?<\/desc>/, '')
  .replace('role="img"', 'aria-hidden="true"')
</script>

<template>
  <span
    data-testid="brand-logo"
    :class="[
      size === 'lg' ? 'h-16 w-16' : size === 'md' ? 'h-8 w-8' : 'h-6 w-6',
      'inline-flex shrink-0 items-center justify-center [&>svg]:block [&>svg]:h-full [&>svg]:w-full',
    ]"
    v-html="logo"
  ></span>
</template>
