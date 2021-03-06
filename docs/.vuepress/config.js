module.exports = {
    title: '.Net 实战笔记',
    description: '熟知.NET Core核心组件设计原理;基于DDD开发云原生微服务应用;掌握.NET Core工程设计最佳实践;提升K8s微服务部署与维护技能',
    base: '/dotnet/',
    head: [
        ['link', {
            rel: 'icon',
            href: 'https://i.loli.net/2020/02/25/AOjBhkIxtb8dRgl.png'
        }]
    ],
    plugins: [
        '@vuepress/active-header-links',
        '@vuepress/back-to-top',
        ['@vuepress/google-analytics', {
            ga: 'UA-131744342-1'
        }]
    ],
    themeConfig: {
        repo: 'https://github.com/colin-chang/dotnet',
        nav: [{
                text: 'Get Start',
                link: '/basic/introduction'
            },
            {
                text: 'Books',
                items: [
                    { text: 'Python', link: 'https://ccstudio.org/python' },
                    { text: 'Linux', link: 'https://ccstudio.org/linux' },
                    { text: '系统架构设计', link: 'https://ccstudio.org/architecture' }
                  ]
            },
            {
                text: 'Blog',
                link: 'https://ccstudio.org/'
            }
        ],
        sidebar:[
            {
                title: '.Net基础',
                collapsable: false,
                children: [
                    '/basic/introduction',
                    '/basic/configuration',
                    '/basic/options',
                    '/basic/fileprovider',
                    '/basic/log',
                    '/basic/pipeline',
                    '/basic/lifetime',
                    '/basic/envar',
                    '/basic/cachesession',
                    '/basic/auth'
                ]
            },
            {
                title: '依赖注入',
                collapsable: false,
                children: [
                    '/di/introduction',
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
                title: '中间件',
                collapsable: false,
                children: [
                    '/middleware/basic',
                    '/middleware/exception',
                    '/middleware/staticfiles'
                ]
            },
            {
                title: 'EF Core',
                collapsable: false,
                children: [
                    '/ef/basic'
                ]
            },
            {
                title: 'WebAPI',
                collapsable: false,
                children: [
                    '/api/basic',
                    '/api/route',
                    '/api/multi-version',
                    '/api/openapi'
                ]
            },
            {
                title: '多任务',
                collapsable: false,
                children: [
                    '/multitask/thread',
                    '/multitask/asynchronous'
                ]
            },
            {
                title: '其他主题',
                collapsable: false,
                children: [
                    '/others/jwt',
                    '/others/automapper',
                    '/others/dapper',
                    '/others/staticize',
                    '/others/unittest',
                    '/others/https'
                ]
            }
        ],
        displayAllHeaders: true,
        sidebarDepth: 2,
        lastUpdated: 'Last Updated'
    },
    markdown: {
        lineNumbers: true
    }
}
