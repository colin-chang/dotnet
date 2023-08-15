import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: ".Net 实战笔记",
  description: "熟知.NET核心组件设计原理;基于DDD开发云原生微服务应用;掌握.NET工程设计最佳实践;提升K8s微服务部署与维护技能",
  lastUpdated: true,
  head: [['link', { rel: 'icon', href: 'https://s2.loli.net/2023/08/14/dWrCDTFK9z1m5Ii.png' }]],
  themeConfig: {
    logo: { src: 'https://s2.loli.net/2023/08/14/dWrCDTFK9z1m5Ii.png', width: 24, height: 24 },
    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'Books',
        items: [
          {
            text: 'Python',
            link: 'https://python.a-nomad.com'
          },
          {
            text: '大前端',
            link: 'https://frontend.a-nomad.com'
          },
          {
            text: 'Linux',
            link: 'https://linux.a-nomad.com'
          }
        ]
      },
    ],

    sidebar: [
      {
        text: '.Net基础',
        collapsed: false,
        items: [
          { text: '前言', link: 'basic/introduction' },
          { text: '多线程', link: 'basic/thread' },
          { text: '异步编程', link: 'basic/asynchronous' }
        ]
      },
      {
        text: '依赖注入',
        collapsed: false,
        items: [
          { text: '控制反转（IoC）', link: 'di/ioc' },
          { text: '基于IoC的设计模式', link: 'di/dm' },
          { text: '依赖注入（DI）', link: 'di/di' },
          { text: '.Net 服务注册', link: 'di/register' },
          { text: '.Net 服务消费', link: 'di/consume' },
          { text: '服务生命周期', link: 'di/lifetime' },
          { text: 'Asp.Net 依赖注入使用', link: 'di/aspnet' },
          { text: 'Asp.Net 依赖注入源码分析', link: 'di/src' }
        ]
      },
      {
        text: '文件系统',
        link: 'file_system/file_provider'
      },
      {
        text: '配置选项',
        collapsed: false,
        items: [
          { text: '配置框架', link: 'config/configuration' },
          { text: '选项框架', link: 'config/options' }
        ]
      },
      {
        text: '日志框架',
        collapsed: false,
        items: [
          { text: '日志框架', link: 'log/framework' },
          { text: 'ELK', link: 'log/elk' },
          { text: 'Exceptionless', link: 'log/exceptionless' }
        ]
      },
      {
        text: '承载系统',
        link: 'hosting/hosted_service'
      },
      {
        text: '管道',
        collapsed: false,
        items: [
          { text: '管道式请求处理', link: 'pipeline/pipe' },
          { text: '依赖注入', link: 'pipeline/di' },
          { text: '配置', link: 'pipeline/configuration' },
          { text: '承载环境', link: 'pipeline/enviroment' }
        ]
      },
      {
        text: '静态文件',
        link: 'static_file/staticfiles'
      },
      {
        text: '路由',
        collapsed: false,
        items: [
          { text: '路由', link: 'route/introduction' },
          { text: '请求解析', link: 'route/hostfiltering' }
        ]
      },
      {
        text: '异常处理',
        link: 'exception/introduction'
      },
      {
        text: '缓存',
        link: 'cache/introduction'
      },
      {
        text: '会话',
        link: 'session/introduction'
      },
      {
        text: '认证授权',
        collapsed: false,
        items: [
          { text: '认证', link: 'auth/authentication' },
          { text: '授权', link: 'auth/authorize' },
          { text: 'JWT', link: 'auth/jwt' }
        ]
      },
      {
        text: 'IdentityServer',
        collapsed: false,
        items: [
          { text: 'OAuth2.0 / OpenID Connect', link: 'identity_server/oauth2' },
          { text: 'Client Credentials', link: 'identity_server/cc' },
          { text: 'Resource Owner Password Credentials', link: 'identity_server/ropc' },
          { text: 'Authorization Code', link: 'identity_server/code' },
          { text: 'Implicit', link: 'identity_server/implicit' },
          { text: 'Hybrid', link: 'identity_server/hybrid' },
          { text: 'Identity Server 授权', link: 'identity_server/authorization' },
          { text: '第三方登录', link: 'identity_server/third_party' }
        ]
      },
      {
        text: '数据访问',
        collapsed: false,
        items: [
          { text: 'EF Core 基础', link: 'data_access/efcore' },
          { text: 'Dapper', link: 'data_access/dapper' }
        ]
      },
      {
        text: 'WebAPI',
        collapsed: false,
        items: [
          { text: 'WebAPI基础', link: 'api/basic' },
          { text: '多版本管理', link: 'api/multi-version' },
          { text: 'OpenAPI', link: 'api/openapi' }
        ]
      },
      {
        text: '跨域资源共享',
        link: 'cors/introduction'
      },
      {
        text: '本地化',
        link: 'localization/introduction'
      },
      {
        text: '健康检查',
        link: 'health_check/introduction'
      },
      {
        text: '其他主题',
        collapsed: false,
        items: [
          { text: 'AutoMappper', link: 'others/automapper' },
          { text: '页面静态化', link: 'others/staticize' },
          { text: '单元测试', link: 'others/unittest' },
          { text: 'HTTPS', link: 'others/https' }
        ]
      }
    ],
    outline: 'deep',

    socialLinks: [
      { icon: { svg: '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg t="1692000911469" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1832" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200"><path d="M344.407934 453.627004c-29.198618-5.799725-56.39733 17.799157-56.39733 47.597746V602.019978c0 20.399034 14.199328 36.798258 33.398419 43.997917 36.398277 13.599356 62.597036 48.79769 62.597037 89.995739 0 52.997491-42.997964 95.995455-95.995456 95.995456s-95.995455-42.997964-95.995455-95.995456V240.037116c0-26.598741-21.398987-47.997728-47.997727-47.997728H48.021966c-26.598741 0-47.997728 21.398987-47.997727 47.997728v495.976518c0 178.991526 164.192227 320.384832 349.98343 281.386678 108.794849-22.798921 196.590693-110.794755 219.389614-219.389613 34.798353-165.792151-73.996497-314.385116-224.989349-344.383695zM418.00445 0.048478c-18.399129-0.999953-33.99839 13.599356-33.99839 31.998485v63.197008c0 16.999195 13.199375 30.998532 29.998579 31.798494 258.787748 13.999337 466.777901 223.989396 481.777191 482.977134 0.999953 16.799205 14.99929 29.99858 31.798495 29.99858h64.196961c18.399129 0 32.998438-15.599261 31.998485-33.99839C1006.776575 279.635241 744.388998 17.247663 418.00445 0.048478z m0.599972 191.99091c-18.599119-1.399934-34.598362 13.399366-34.598362 32.198476v64.19696c0 16.799205 12.999385 30.598551 29.598598 31.798495 153.592728 12.599403 275.986934 136.393543 289.786281 290.386252 1.599924 16.599214 15.19928 29.398608 31.798494 29.398608h64.396952c18.599119 0 33.598409-15.999243 32.198475-34.598362-16.799205-220.189575-192.990863-396.381234-413.180438-413.380429z" p-id="1833"></path></svg>' }, link: 'https://a-nomad.com' },
      { icon: 'youtube', link: 'https://www.youtube.com/channel/UCMhN4CHJMuSOYe9CMXIoV7Q?sub_confirmation=1' },
      { icon: 'github', link: 'https://github.com/colin-chang/dotnet' }
    ],
    editLink: {
      pattern: 'https://github.com/colin-chang/dotnet/edit/main/docs/:path'
    },
    footer: {
      message: 'Released under the MIT License.',
      copyright: "Copyright © <a href='https://a-nomad.com' target='_blank'>A-Nomad</a> 2018"
    },
    search: {
      provider: 'algolia',
      options: {
        appId: 'YYF9U397JI',
        apiKey: '045a7cac2595ebf902fd3842450cb312',
        indexName: 'dotnet-a-nomad'
      }
    },
  },
  markdown: {
    lineNumbers: true
  }
})
