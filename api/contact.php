<?php

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed.'
    ]);
    exit;
}

$config = require '/home1/unistarc/mailgun-config.php';

$formStartedAt = trim($_POST['formStartedAt'] ?? '');
$name          = trim($_POST['name'] ?? '');
$company       = trim($_POST['company'] ?? '');
$email         = trim($_POST['email'] ?? '');
$phone         = trim($_POST['phone'] ?? '');
$product       = trim($_POST['product'] ?? '');
$inquiry       = trim($_POST['inquiry'] ?? '');
$message       = trim($_POST['message'] ?? '');

/*
|--------------------------------------------------------------------------
| Required fields
|--------------------------------------------------------------------------
*/

if (
    $name === '' ||
    $company === '' ||
    $email === '' ||
    $inquiry === '' ||
    $message === ''
) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Please complete all required fields.'
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| Email validation
|--------------------------------------------------------------------------
*/

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Please enter a valid email address.'
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| Basic bot timing check
|--------------------------------------------------------------------------
|
| Reject submissions made unrealistically quickly after the form loaded.
|
*/

if ($formStartedAt !== '') {
    $startedTimestamp = strtotime($formStartedAt);

    if ($startedTimestamp !== false) {
        $elapsed = time() - $startedTimestamp;

        if ($elapsed < 2) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Unable to process submission.'
            ]);
            exit;
        }
    }
}

/*
|--------------------------------------------------------------------------
| Allowed inquiry types
|--------------------------------------------------------------------------
*/

$allowedInquiryTypes = [
    'Quote Request',
    'SDS Request',
    'TDS Request',
    'Technical Guidance',
    'Sample Request',
    'General Inquiry'
];

if (!in_array($inquiry, $allowedInquiryTypes, true)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Invalid inquiry type.'
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| Prevent header injection
|--------------------------------------------------------------------------
*/

foreach ([$name, $company, $email, $phone, $product, $inquiry] as $field) {
    if (preg_match('/[\r\n]/', $field)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid form data.'
        ]);
        exit;
    }
}

/*
|--------------------------------------------------------------------------
| Build email
|--------------------------------------------------------------------------
*/

$subject = 'Website ' . $inquiry . ' - ' . $name;

$body = implode("\n", [
    'New Unistar Chemical website inquiry',
    '',
    'Name: ' . $name,
    'Company: ' . $company,
    'Email: ' . $email,
    'Phone: ' . ($phone !== '' ? $phone : 'Not provided'),
    'Product of Interest: ' . ($product !== '' ? $product : 'Not specified'),
    'Inquiry Type: ' . $inquiry,
    '',
    'Message:',
    $message
]);

$postData = [
    'from' => 'Unistar Website <website@mg.unistarchemical.com>',
    'to' => 'info@unistarchemical.com',
    'h:Reply-To' => $email,
    'subject' => $subject,
    'text' => $body
];

/*
|--------------------------------------------------------------------------
| Send through Mailgun
|--------------------------------------------------------------------------
*/

$ch = curl_init();

curl_setopt_array($ch, [
    CURLOPT_URL =>
        'https://api.mailgun.net/v3/' .
        rawurlencode($config['domain']) .
        '/messages',

    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $postData,
    CURLOPT_USERPWD => 'api:' . $config['api_key'],
    CURLOPT_TIMEOUT => 15,
    CURLOPT_CONNECTTIMEOUT => 10
]);

$response = curl_exec($ch);
$status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error    = curl_error($ch);

curl_close($ch);

if ($response === false || $status < 200 || $status >= 300) {
    error_log(
        'Mailgun contact form failure. HTTP status: ' .
        $status .
        ' CURL error: ' .
        $error
    );

    http_response_code(500);

    echo json_encode([
        'success' => false,
        'message' => 'Unable to send message right now.'
    ]);

    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Message sent successfully.'
]);