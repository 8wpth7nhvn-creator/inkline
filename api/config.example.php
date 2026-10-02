<?php
// Inkline AI settings. Copy this file to config.php and add your key there.
// config.php is listed in .gitignore, so your key never ends up on GitHub.
// Until a key is added, the CV maker runs its built-in guided interview instead.

return [
    // Paste your Claude API key between the quotes (it starts with sk-ant-).
    'anthropic_api_key' => '',

    // Which Claude model writes the CVs. Rough cost per finished CV:
    //   'claude-opus-5-5'   best writing, about $0.30 to $0.40
    //   'claude-sonnet-5-5' very good, about $0.15 to $0.20
    //   'claude-haiku-4-5'  good and fastest, about $0.08 to $0.10
    // Reading an uploaded old CV adds roughly $0.03 to $0.08 on top.
    'model' => 'claude-opus-5-5',

    // Safety limits so nobody can run up your bill.
    'per_visitor_per_10_min' => 30,
    'per_visitor_per_day'    => 200,
    'all_visitors_per_day'   => 3000,
];
