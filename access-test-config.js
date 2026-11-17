// 访问测试页的 Supabase 设置。项目网址和 publishable（公开）密钥本来就是公开的，可以放在这里；
// 绝不能放 service_role / secret 密钥。留空时，测试页只测网站文件，并显示“Supabase 未配置”。
window.ACCESS_TEST_CONFIG = { supabaseUrl: "", supabaseKey: "" };
