<?php
 
// TESTING ONLY — don't commit this file or deploy it publicly with a real key inline.
$key = "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";
 
if (!$key || $key === "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") {
    die("Set your API key in the \$key variable at the top of chat.php.");
}
 
if (!isset($_POST["prompt"]) || trim($_POST["prompt"]) === "") {
    die("Missing 'prompt' POST parameter.");
}
 
$data = [
    "model" => "gpt-5.6-luna", // double check this model name — "gpt-5.6-luna" isn't a real OpenAI model id
    "input" => $_POST["prompt"]
];
 
$ch = curl_init("https://api.openai.com/v1/responses");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer " . $key,
        "Content-Type: application/json"
    ],
    CURLOPT_POSTFIELDS => json_encode($data)
]);
 
$result = curl_exec($ch);
 
if (curl_errno($ch)) {
    $err = curl_error($ch);
    curl_close($ch);
    die("cURL Error: " . $err);
}
 
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
 
if ($http != 200) {
    die("API returned HTTP $http: " . $result);
}
 
$json = json_decode($result, true);
 
if (json_last_error() !== JSON_ERROR_NONE) {
    die("Failed to decode JSON response: " . json_last_error_msg());
}
 
$text = "";
if (isset($json["output"])) {
    foreach ($json["output"] as $item) {
        if (isset($item["content"])) {
            foreach ($item["content"] as $c) {
                if (isset($c["text"])) {
                    $text .= $c["text"];
                }
            }
        }
    }
}
 
if ($text !== "") {
    echo htmlspecialchars($text);
} else {
    echo "<pre>";
    print_r($json);
    echo "</pre>";
}
 
