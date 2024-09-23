const fs = require("fs");
const path = require("path");

// Function to generate messages for the batch request
function getMessages(subject, chapter, topic, grade) {
  return [
    {
      role: "system",
      content:
        "You are an expert educator. Guide the user to content generation and OBJECTIVE and SUBJECTIVE questions",
    },
    {
      role: "user",
      content: `As an expert educator in ${subject}, provide a comprehensive content and OBJECTIVE and SUBJECTIVE questions of the topic "${topic}" from the chapter "${chapter}". Your explanation should:
      1. Start with a clear, concise definition or introduction to the topic.
      2. Explain the key concepts, principles, or theories related to this topic.
      3. Provide relevant examples, analogies, or real-world applications to illustrate the topic.
      4. If applicable, include any important formulas, equations, or diagrams (described in text).
      5. Discuss any historical context or significant developments related to this topic.
      6. Highlight the importance or relevance of this topic within the broader subject area.
      7. Address common misconceptions or difficulties students might have with this topic.
      8. Provide diagrams in Markdown format if possible.

Your content and OBJECTIVE and SUBJECTIVE questions should be suitable for a ${grade}th grade student, balancing depth of content with clarity of explanation.`,
    },
  ];
}

// Function to generate a batch request entry for a single topic
function createBatchRequest(subject, chapter, topic, customId, grade) {
  return {
    custom_id: customId,
    method: "POST",
    url: "/v1/chat/completions",
    body: {
      model: "gpt-4",
      messages: getMessages(subject, chapter, topic, grade),
      max_tokens: 4096,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "content_with_questions",
          schema: {
            type: "object",
            properties: {
              grade: { type: "string" },
              subject: { type: "string" },
              chapter: { type: "string" },
              chapterTopic: { type: "string" },
              content: { type: "string" },
              questions: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: {
                      type: "string",
                      enum: ["OBJECTIVE", "SUBJECTIVE"],
                    },
                    questionText: { type: "string" },
                    options: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          text: { type: "string" },
                          isCorrect: { type: "boolean" },
                        },
                      },
                    },
                    explanation: { type: "string" },
                  },
                  required: ["type", "questionText", "explanation"],
                },
              },
            },
            required: [
              "grade",
              "subject",
              "chapter",
              "chapterTopic",
              "content",
              "questions",
            ],
          },
          strict: true,
        },
      },
    },
  };
}

// Function to process a single chapter
async function processChapter(
  subject,
  chapterData,
  chapterName,
  grade,
  outputFilePath,
  batchFilePath
) {
  const chapterOutput = {
    chapter: chapterData[0].chapter,
    topics: [],
  };

  const batchRequests = [];

  let customIdCounter = 1;

  for (const topic of chapterData[0].topics) {
    const batchRequest = createBatchRequest(
      subject,
      chapterName,
      topic,
      `request-${customIdCounter++}`,
      grade
    );

    batchRequests.push(batchRequest);
    chapterOutput.topics.push({ topic: topic });
  }

  // Write batch requests to the batch JSONL file
  fs.appendFileSync(
    batchFilePath,
    batchRequests.map((r) => JSON.stringify(r)).join("\n") + "\n"
  );

  // Write chapter output (content structure) to file
  fs.writeFileSync(outputFilePath, JSON.stringify(chapterOutput, null, 2));
}

// Function to process the syllabus
async function processSyllabus(
  folderPath,
  outputFolderPath,
  batchFolderPath,
  grade
) {
  try {
    const subjects = fs.readdirSync(folderPath);

    for (const subject of subjects) {
      const subjectFolderPath = path.join(folderPath, subject);
      const outputSubjectFolderPath = path.join(outputFolderPath, subject);
      const batchSubjectFolderPath = path.join(batchFolderPath, subject);

      if (!fs.existsSync(outputSubjectFolderPath)) {
        fs.mkdirSync(outputSubjectFolderPath, { recursive: true });
      }
      if (!fs.existsSync(batchSubjectFolderPath)) {
        fs.mkdirSync(batchSubjectFolderPath, { recursive: true });
      }

      const chapters = fs.readdirSync(subjectFolderPath);

      for (const chapterFile of chapters) {
        const chapterFilePath = path.join(subjectFolderPath, chapterFile);
        const chapterName = path.parse(chapterFile).name;
        const outputFilePath = path.join(
          outputSubjectFolderPath,
          `${chapterName}.json`
        );
        const batchFilePath = path.join(
          batchSubjectFolderPath,
          `batch_${chapterName}.jsonl`
        );

        // Read the chapter data
        const data = fs.readFileSync(chapterFilePath, "utf8");
        const chapterData = JSON.parse(data);

        await processChapter(
          subject,
          chapterData,
          chapterName,
          grade,
          outputFilePath,
          batchFilePath
        );
      }
    }
  } catch (err) {
    console.error(`Error processing syllabus: ${err}`);
  }
}

// Define the source and output paths
const syllabusFolder = path.join(__dirname, "syllabus");
const outputFolder = path.join(__dirname, "content");
const batchFolder = path.join(__dirname, "batch");

// Ensure the output and batch folders exist
if (!fs.existsSync(outputFolder)) {
  fs.mkdirSync(outputFolder, { recursive: true });
}
if (!fs.existsSync(batchFolder)) {
  fs.mkdirSync(batchFolder, { recursive: true });
}

// Process the syllabus for both 11th and 12th grades
processSyllabus(
  path.join(syllabusFolder, "11"),
  path.join(outputFolder, "11"),
  path.join(batchFolder, "11"),
  "11"
);
processSyllabus(
  path.join(syllabusFolder, "12"),
  path.join(outputFolder, "12"),
  path.join(batchFolder, "12"),
  "12"
);
