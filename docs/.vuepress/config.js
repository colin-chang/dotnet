module.exports = {
    title: '.Net 实战笔记',
    description: '熟知.NET核心组件设计原理;基于DDD开发云原生微服务应用;掌握.NET工程设计最佳实践;提升K8s微服务部署与维护技能',
    base: '/',
    head: [
        ['link', {
            rel: 'icon',
            href: 'https://cdn.hashnode.com/res/hashnode/image/upload/v1658902565243/IDyIb_63A.png'
        }]
    ],
    plugins: [
        '@vuepress/active-header-links',
        '@vuepress/back-to-top',
        '@vuepress/last-updated',
        '@vuepress/medium-zoom',
        ['@vuepress/google-analytics', {
            ga: 'UA-131744342-1'
        }]
    ],
    themeConfig: {
        logo:'https://s2.loli.net/2022/08/04/UXqgLBVfzPuvb5A.png',
        repo: 'https://github.com/colin-chang/dotnet',
        nav: [{
                text: 'Get Start',
                link: '/basic/introduction'
            },
            {
                text: 'Books',
                items: [
                    { text: 'Python', link: 'https://python.a-nomad.com' },
                    { text: 'Linux', link: 'https://linux.a-nomad.com' },
                    { text: '系统架构设计', link: 'https://architecture.a-nomad.com' }
                  ]
            },
            {
                text: 'Blog',
                link: 'https://a-nomad.com/'
            }
        ],
        sidebar:[
            {
                title: '.Net基础',
                collapsable: true,
                children: [
                    '/basic/introduction',
                    '/basic/thread',
                    '/basic/asynchronous'
                ]
            },
            {
                title: '依赖注入',
                collapsable: true,
                children: [
                    '/di/ioc',
                    '/di/dm',
                    '/di/di',
                    '/di/register',
                    '/di/consume',
                    '/di/lifetime',
                    '/di/aspnet',
                    '/di/src'
                ]
            },
            {
                title: '文件系统',
                collapsable: true,
                children: [
                    '/file_system/file_provider'
                ]
            },
            {
                title: '配置选项',
                collapsable: true,
                children: [
                    '/config/configuration',
                    '/config/options'
                ]
            },
            {
                title: '日志框架',
                collapsable: true,
                children: [
                    '/log/framework',
                    '/log/elk',
                    '/log/exceptionless'
                ]
            },
            {
                title: '承载系统',
                collapsable: true,
                children: [
                    '/hosting/hosted_service'
                ]
            },
            {
                title: '管道',
                collapsable: true,
                children: [
                    '/pipeline/pipe',
                    '/pipeline/di',
                    '/pipeline/configuration',
                    '/pipeline/enviroment'
                ]
            },
            {
                title: '静态文件',
                collapsable: true,
                children: [
                    '/static_file/staticfiles'
                ]
            },
            {
                title: '路由',
                collapsable: true,
                children: [
                    'route/introduction',
                    'route/hostfiltering'
                ]
            },
            {
                title: '异常处理',
                collapsable: true,
                children: [
                    '/exception/introduction'
                ]
            },
            {
                title: '缓存',
                collapsable: true,
                children: [
                    'cache/introduction'
                ]
            },
            {
                title: '会话',
                collapsable: true,
                children: [
                    'session/introduction'
                ]
            },
            {
                title: '认证授权',
                collapsable: true,
                children: [
                    '/auth/authentication',
                    '/auth/authorize',
                    '/auth/jwt'
                ]
            },
            {
                title: 'IdentityServer',
                collapsable: true,
                children: [
                    '/identity_server/oauth2',
                    '/identity_server/cc',
                    '/identity_server/ropc',
                    '/identity_server/code',
                    '/identity_server/implicit',
                    '/identity_server/hybrid',
                    '/identity_server/authorization',
                    '/identity_server/third_party'
                ]
            },
            {
                title: '数据访问',
                collapsable: true,
                children: [
                    '/data_access/efcore',
                    '/data_access/dapper'
                ]
            },
            {
                title: 'WebAPI',
                collapsable: true,
                children: [
                    '/api/basic',
                    '/api/multi-version',
                    '/api/openapi'
                ]
            },
            {
                title: '跨域资源共享',
                collapsable: true,
                children: [
                    'cors/introduction'
                ]
            },
            {
                title: '本地化',
                collapsable: true,
                children: [
                    'localization/introduction'
                ]
            },
            {
                title: '健康检查',
                collapsable: true,
                children: [
                    'health_check/introduction'
                ]
            },
            {
                title: '其它主题',
                collapsable: true,
                children: [
                    '/others/automapper',
                    '/others/staticize',
                    '/others/unittest',
                    '/others/https'
                ]
            }
        ],
        sidebarDepth:3,
        displayAllHeaders: true,
        lastUpdated: '更新时间'
    },
    markdown: {
        lineNumbers: true
    }
}
