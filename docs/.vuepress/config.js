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
                collapsable: true,
                children: [
                    '/basic/introduction',
                    '/basic/thread',
                    '/basic/asynchronous'
                ]
            },
            {
                title: '管道模型',
                collapsable: true,
                children: [
                    '/hosting/pipeline',
                    '/hosting/lifetime'
                ]
            },
            {
                title: '依赖注入',
                collapsable: true,
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
                title: '文件系统与配置选项',
                collapsable: true,
                children: [
                    '/config/fileprovider',
                    '/config/configuration',
                    '/config/options'
                ]
            },
            {
                title: '.Net Core 其他组件',
                collapsable: true,
                children: [
                    '/component/log',
                    '/component/envar',
                    '/component/cachesession'
                ]
            },
            {
                title: '中间件',
                collapsable: true,
                children: [
                    '/middleware/basic',
                    '/middleware/exception',
                    '/middleware/staticfiles'
                ]
            },
            {
                title: '认证授权',
                collapsable: true,
                children: [
                    '/auth/auth',
                    '/auth/jwt'
                ]
            },
            {
                title: 'EF Core',
                collapsable: true,
                children: [
                    '/ef/basic'
                ]
            },
            {
                title: 'WebAPI',
                collapsable: true,
                children: [
                    '/api/basic',
                    '/api/route',
                    '/api/multi-version',
                    '/api/openapi'
                ]
            },
            {
                title: '其他主题',
                collapsable: true,
                children: [
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
